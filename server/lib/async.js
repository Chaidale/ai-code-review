export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  let nextIndex = 0;
  const END = Symbol("END");

  function takeNextIndex() {
    if (nextIndex >= items.length) {
      return END;
    }

    const claimedIndex = nextIndex;
    nextIndex += 1;
    return claimedIndex;
  }

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = takeNextIndex();

        if (index === END) {
          break;
        }

        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}
