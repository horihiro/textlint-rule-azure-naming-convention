import { TextlintRuleModule } from "@textlint/types";
import { BicepASTNodeTypes } from "@horihiro/textlint-plugin-bicep";
import type { BicepTextNode, BicepObject, BicepArray, BicepResource, BicepArrayElement } from "@horihiro/textlint-plugin-bicep";
import resourceNamePatterns from "./resource-naming-patterns";

// Options
export interface Options {
  // If node's text includes allowed text, does not report.
  allows?: string[];
}

const operators: { [operator: string]: (a: string, b: string) => boolean } = {
  "=": (a: string, b: string) => a === b,
  "^=": (a: string, b: string) => a.startsWith(b),
  "*=": (a: string, b: string) => a.includes(b),
  "$=": (a: string, b: string) => a.endsWith(b),
};

// get the field by name
// @param fields: { name: BicepTextNode; value: BicepTextNode | BicepObject | BicepArray; }[]
// @param name: string
// @returns { name: BicepTextNode; value: BicepTextNode | BicepObject | BicepArray; } | undefined
const getFieldByName = (fields: { name: BicepTextNode; value: BicepTextNode | BicepObject | BicepArray; }[], name: string): { name: BicepTextNode; value: BicepTextNode | BicepObject | BicepArray; } | undefined => {
  return fields.find((field: {
    name: BicepTextNode;
    value: BicepTextNode | BicepObject | BicepArray;
  }) => field.name.value === name);
}

const reKeyFormant = /\[(?<pathes>[^\^*$=]*)(?:(?<op>[\^*$]?=)(?<value>.*))?\]/;
const rePathFormant = /(?<name>.+?)(?<index>\[(?<position>\d+)\])?$/;

// get the pattern by the resource
// @param resource: BicepResource
// @param patterns: any
// @returns string | undefined
const getPattern = (resource:BicepResource, patterns: {[key: string]: string}) => {
  const normalizedResourceType = `${resource.provider?.toLowerCase()}/${resource.resourceType.toLowerCase()}`;
  const matchingKey = Object.keys(patterns)
  .filter(key => key.toLowerCase().replace(/\[.*$/, '') === normalizedResourceType)
  .sort((a, b) => b.length - a.length)
  .find(key => {
    const keyElements = key.match(reKeyFormant)?.groups;
    if (!keyElements) return true;

    const { pathes, op, value } = keyElements;
    const targetObject = pathes.split("/").reduce((target: BicepResource | BicepArrayElement | undefined, path:string): BicepArrayElement | undefined => {
      if (!target) return undefined;
      if (target.type === BicepASTNodeTypes.BicepTextNode || target.type === BicepASTNodeTypes.BicepArray) return target;

      const pathElements = path.match(rePathFormant)?.groups;
      if (!pathElements) return undefined;
      const {name, index, position: indexPosition} = pathElements;
      const field = getFieldByName(target.fields, name);
      if (field?.value.type === BicepASTNodeTypes.BicepArray) {
        if (index) {
          return field.value.elements[parseInt(indexPosition)];
        } else if (!op ) {
          return field.value;
        }
        return undefined;
      }
      return field?.value;
    }, resource);
    if (!op && targetObject) return true;
    if (!targetObject) return false;
    const nodeValue = (targetObject as BicepTextNode).value.replace(/(?:^'|'$)/g, '').toLowerCase();

    try {
      return operators[op](nodeValue, value.toLowerCase());
    } catch (e) {
      console.error(`Unkown operator: ${op}`);
      console.error(e);
    }
    return false;
  });
  return matchingKey ? {key: matchingKey, pattern: patterns[matchingKey]} : undefined;
}

// @param context: any
// @param options: Options
const report: TextlintRuleModule<Options> = (context, options = {}) => {
  const { RuleError, report, locator } = context;
  const customPatterns = options.patterns ?? {};
  return {
    [BicepASTNodeTypes.BicepResource](node) {
      const fields = node.fields;
      const nameField = getFieldByName(fields, 'name');
      if (!nameField) return;

      const p = getPattern(node, customPatterns)
                   || getPattern(node, resourceNamePatterns);
      if (!p) return;
      
      if (nameField?.value.type !== BicepASTNodeTypes.BicepTextNode || nameField?.value.dataType != String || new RegExp(p.pattern).test(nameField?.value.value.replace(/(?:^'|'$)/g, ''))) {
        return;
      }
      const ruleError = new RuleError(`[Naming violation] The name for '${p.key}' should match by the pattern '${p.pattern}'.`, {
        padding: locator.range([
          nameField.value.range[0] - node.range[0] + 1,
          nameField.value.range[1] - node.range[0] - 1
        ]),
      });
      report(node, ruleError);
    }
  }
};

export default report;
