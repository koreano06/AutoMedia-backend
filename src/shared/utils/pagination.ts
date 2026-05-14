export function getPagination(page = 1, perPage = 20) {
  const take = Math.min(Math.max(perPage, 1), 100);
  const skip = Math.max(page - 1, 0) * take;
  return { skip, take };
}
