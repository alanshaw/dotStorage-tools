export const mustGetEnv = key => {
  if (!process.env[key]) throw new Error(`missing environment variable: ${key}`)
  return process.env[key]
}
