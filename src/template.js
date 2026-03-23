export const DEFAULT_TEMPLATE = `You are a precise analysis assistant.

Source title: {{title}}
Source URL: {{url}}

Selected content:
{{selection}}

Please provide:
1) Key conclusion
2) Potential logic gaps
3) Confidence level`;

export function getEffectiveTemplate(template) {
  if (typeof template !== 'string') {
    return DEFAULT_TEMPLATE;
  }

  return template.trim() ? template : DEFAULT_TEMPLATE;
}

export function renderTemplate(template, variables) {
  const effectiveTemplate = getEffectiveTemplate(template);
  const selection = variables?.selection ?? '';
  const title = variables?.title ?? '';
  const url = variables?.url ?? '';

  return effectiveTemplate
    .replaceAll('{{selection}}', selection)
    .replaceAll('{{title}}', title)
    .replaceAll('{{url}}', url);
}
