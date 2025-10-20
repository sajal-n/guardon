import yaml from 'js-yaml';
import { guardrailRules } from './rules.js';

export function validateYaml(content) {
  try {
    const doc = yaml.load(content);
    const results = guardrailRules.map(rule => ({
      rule: rule.description,
      violated: rule.validate(doc)
    }));
    return results.filter(r => r.violated);
  } catch (e) {
    return [{ error: "Invalid YAML format" }];
  }
}