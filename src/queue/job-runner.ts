export async function runJob(jobName: string, payload: unknown) {
  // TODO: despachar para workers reais.
  return { jobName, payload, status: "queued" };
}
