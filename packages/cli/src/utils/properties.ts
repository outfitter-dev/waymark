// tldr ::: parse property key/value arguments for CLI flags

export type PropertyEntry = {
  key: string;
  value: string;
};

const PROPERTY_ERROR_MESSAGE =
  "--property expects key=value or key:value format";

export function parsePropertyEntry(value: string): PropertyEntry {
  const separatorIndex =
    value.indexOf("=") >= 0 ? value.indexOf("=") : value.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error(PROPERTY_ERROR_MESSAGE);
  }
  const key = value.slice(0, separatorIndex).trim();
  const propValue = value.slice(separatorIndex + 1).trim();
  if (!(key && propValue)) {
    throw new Error(PROPERTY_ERROR_MESSAGE);
  }
  return { key, value: propValue };
}
