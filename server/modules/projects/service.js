import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { createHttpError } from "../../lib/errors.js";
import { db } from "../../db/client.js";
import { analysisRuns, projects } from "../../db/schema.js";

function normalizeTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
}

function slugify(value) {
  const normalizedValue = normalizeTrimmedString(value).toLowerCase();

  return normalizedValue
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "project";
}

function validateAnalysisType(value) {
  const normalizedValue = normalizeTrimmedString(value);

  return ["pr-review", "pr-monitoring"].includes(normalizedValue)
    ? normalizedValue
    : "pr-monitoring";
}

function serializeProject(row) {
  if (!row) {
    return null;
  }

  const repositoryOwner = normalizeTrimmedString(row.repositoryOwner);
  const repositoryName = normalizeTrimmedString(row.repositoryName);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    defaultBranch: row.defaultBranch,
    defaultEnvironment: row.defaultEnvironment,
    defaultAnalysisType: row.defaultAnalysisType,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    lastAnalysisAt: toIsoString(row.lastAnalysisAt),
    analysisCount: Number(row.analysisCount ?? 0),
    repository: {
      provider: row.repositoryProvider,
      owner: repositoryOwner || null,
      name: repositoryName || null,
      fullName: repositoryOwner && repositoryName ? `${repositoryOwner}/${repositoryName}` : "",
    },
  };
}

function getProjectSelectShape() {
  return {
    id: projects.id,
    name: projects.name,
    slug: projects.slug,
    status: projects.status,
    repositoryProvider: projects.repositoryProvider,
    repositoryOwner: projects.repositoryOwner,
    repositoryName: projects.repositoryName,
    defaultBranch: projects.defaultBranch,
    defaultEnvironment: projects.defaultEnvironment,
    defaultAnalysisType: projects.defaultAnalysisType,
    createdAt: projects.createdAt,
    updatedAt: projects.updatedAt,
    analysisCount: sql`count(${analysisRuns.id})`,
    lastAnalysisAt: sql`max(${analysisRuns.createdAt})`,
  };
}

async function buildUniqueProjectSlug(baseSlug) {
  const normalizedBaseSlug = slugify(baseSlug);
  const rows = await db.select({
    slug: projects.slug,
  }).from(projects).where(sql`${projects.slug} = ${normalizedBaseSlug} or ${projects.slug} like ${`${normalizedBaseSlug}-%`}`);
  const usedSlugs = new Set(rows.map((row) => row.slug));

  if (!usedSlugs.has(normalizedBaseSlug)) {
    return normalizedBaseSlug;
  }

  let suffix = 2;

  while (usedSlugs.has(`${normalizedBaseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBaseSlug}-${suffix}`;
}

export async function listProjects({ limit = 50 } = {}) {
  const normalizedLimit = Number.isInteger(limit)
    ? limit
    : Math.max(parseInt(limit, 10) || 50, 1);
  const rows = await db.select(getProjectSelectShape())
    .from(projects)
    .leftJoin(analysisRuns, eq(analysisRuns.projectId, projects.id))
    .groupBy(
      projects.id,
      projects.name,
      projects.slug,
      projects.status,
      projects.repositoryProvider,
      projects.repositoryOwner,
      projects.repositoryName,
      projects.defaultBranch,
      projects.defaultEnvironment,
      projects.defaultAnalysisType,
      projects.createdAt,
      projects.updatedAt,
    )
    .orderBy(
      desc(sql`coalesce(max(${analysisRuns.createdAt}), ${projects.createdAt})`),
      desc(projects.createdAt),
    )
    .limit(Math.min(normalizedLimit, 100));

  return rows.map(serializeProject);
}

export async function getProjectById(projectId = "") {
  const normalizedProjectId = normalizeTrimmedString(projectId);

  if (!normalizedProjectId) {
    return null;
  }

  const [row] = await db.select(getProjectSelectShape())
    .from(projects)
    .leftJoin(analysisRuns, eq(analysisRuns.projectId, projects.id))
    .where(eq(projects.id, normalizedProjectId))
    .groupBy(
      projects.id,
      projects.name,
      projects.slug,
      projects.status,
      projects.repositoryProvider,
      projects.repositoryOwner,
      projects.repositoryName,
      projects.defaultBranch,
      projects.defaultEnvironment,
      projects.defaultAnalysisType,
      projects.createdAt,
      projects.updatedAt,
    )
    .limit(1);

  return serializeProject(row);
}

export async function getProjectByIdOrThrow(projectId = "") {
  const project = await getProjectById(projectId);

  if (!project) {
    throw createHttpError(404, "未找到对应的项目", {
      exposeError: false,
    });
  }

  return project;
}

export async function findProjectByRepository({
  repositoryProvider = "github",
  repositoryOwner = "",
  repositoryName = "",
} = {}) {
  const normalizedRepositoryOwner = normalizeTrimmedString(repositoryOwner);
  const normalizedRepositoryName = normalizeTrimmedString(repositoryName);

  if (!normalizedRepositoryOwner || !normalizedRepositoryName) {
    return null;
  }

  const [row] = await db.select(getProjectSelectShape())
    .from(projects)
    .leftJoin(analysisRuns, eq(analysisRuns.projectId, projects.id))
    .where(sql`
      ${projects.repositoryProvider} = ${normalizeTrimmedString(repositoryProvider) || "github"}
      and ${projects.repositoryOwner} = ${normalizedRepositoryOwner}
      and ${projects.repositoryName} = ${normalizedRepositoryName}
    `)
    .groupBy(
      projects.id,
      projects.name,
      projects.slug,
      projects.status,
      projects.repositoryProvider,
      projects.repositoryOwner,
      projects.repositoryName,
      projects.defaultBranch,
      projects.defaultEnvironment,
      projects.defaultAnalysisType,
      projects.createdAt,
      projects.updatedAt,
    )
    .limit(1);

  return serializeProject(row);
}

export async function createProject({
  name = "",
  repositoryOwner = "",
  repositoryName = "",
  defaultBranch = "main",
  defaultEnvironment = "prod",
  defaultAnalysisType = "pr-monitoring",
} = {}) {
  const normalizedName = normalizeTrimmedString(name);
  const normalizedRepositoryOwner = normalizeTrimmedString(repositoryOwner);
  const normalizedRepositoryName = normalizeTrimmedString(repositoryName);

  if (!normalizedName) {
    throw createHttpError(400, "项目名称不能为空", {
      exposeError: false,
    });
  }

  if (!normalizedRepositoryOwner || !normalizedRepositoryName) {
    throw createHttpError(400, "项目必须绑定 GitHub 仓库 owner 和 name", {
      exposeError: false,
    });
  }

  const existingProject = await findProjectByRepository({
    repositoryOwner: normalizedRepositoryOwner,
    repositoryName: normalizedRepositoryName,
  });

  if (existingProject) {
    throw createHttpError(409, "该 GitHub 仓库已经绑定到现有项目", {
      exposeError: false,
    });
  }

  const now = new Date();
  const projectId = randomUUID();
  const slug = await buildUniqueProjectSlug(`${normalizedName}-${normalizedRepositoryOwner}-${normalizedRepositoryName}`);

  await db.insert(projects).values({
    id: projectId,
    name: normalizedName,
    slug,
    status: "active",
    repositoryProvider: "github",
    repositoryOwner: normalizedRepositoryOwner,
    repositoryName: normalizedRepositoryName,
    defaultBranch: normalizeTrimmedString(defaultBranch) || "main",
    defaultEnvironment: normalizeTrimmedString(defaultEnvironment) || "prod",
    defaultAnalysisType: validateAnalysisType(defaultAnalysisType),
    createdAt: now,
    updatedAt: now,
  });

  return getProjectByIdOrThrow(projectId);
}

export async function resolveProjectForPullRequest({
  projectId = "",
  prInfo,
} = {}) {
  const normalizedProjectId = normalizeTrimmedString(projectId);

  if (normalizedProjectId) {
    const project = await getProjectByIdOrThrow(normalizedProjectId);
    const projectRepository = project.repository?.fullName;
    const pullRequestRepository = prInfo?.owner && prInfo?.repo ? `${prInfo.owner}/${prInfo.repo}` : "";

    if (projectRepository && pullRequestRepository && projectRepository !== pullRequestRepository) {
      throw createHttpError(400, `当前项目已绑定仓库 ${projectRepository}，不能分析 ${pullRequestRepository} 的 PR`, {
        exposeError: false,
      });
    }

    return project;
  }

  const existingProject = await findProjectByRepository({
    repositoryOwner: prInfo?.owner,
    repositoryName: prInfo?.repo,
  });

  if (existingProject) {
    return existingProject;
  }

  try {
    return await createProject({
      name: `${prInfo.owner}/${prInfo.repo}`,
      repositoryOwner: prInfo?.owner,
      repositoryName: prInfo?.repo,
      defaultAnalysisType: "pr-monitoring",
    });
  } catch (error) {
    if (error?.status === 409) {
      const project = await findProjectByRepository({
        repositoryOwner: prInfo?.owner,
        repositoryName: prInfo?.repo,
      });

      if (project) {
        return project;
      }
    }

    throw error;
  }
}
