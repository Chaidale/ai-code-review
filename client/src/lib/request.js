export function getRequestErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || fallbackMessage;
}
