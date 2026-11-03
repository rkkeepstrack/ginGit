import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Colors come from CSS variables so one style serves both daisyUI themes.
const style = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: 'var(--syn-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--syn-fn)' },
  { tag: [t.propertyName, t.attributeName, t.labelName], color: 'var(--syn-prop)' },
  { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.compareOperator, t.logicOperator], color: 'var(--syn-op)' },
  { tag: [t.punctuation, t.bracket, t.separator], color: 'var(--syn-punct)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--syn-tag)' },
  { tag: [t.attributeValue], color: 'var(--syn-string)' },
  { tag: [t.heading], fontWeight: 'bold', color: 'var(--syn-keyword)' },
  { tag: [t.link, t.url], color: 'var(--syn-attr)', textDecoration: 'underline' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: 'bold' },
  { tag: [t.invalid], color: 'var(--color-error)' },
])

export const highlighting = syntaxHighlighting(style)
