// A small arithmetic grammar shared by the editor and authoritative game server.
// It accepts numbers/operators only; no JavaScript evaluation or property access.
type Node =
  | { kind: 'number'; value: number }
  | { kind: 'unary'; argument: Node }
  | { kind: 'factorial'; argument: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'function'; name: string; args: Node[] };
const MAX_VALUE = 1e12;
function finite(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE)
    throw new Error('Keep every result finite and within one trillion.');
  return value;
}
function factorial(n: number) {
  if (!Number.isInteger(n) || n < 0 || n > 170)
    throw new Error('Factorial needs a whole number from 0 to 170.');
  let result = 1;
  for (let i = 2; i <= n; i++) result = finite(result * i);
  return result;
}
function combinatorics(n: number, r: number, permutation: boolean) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || n > 170 || r < 0 || r > n)
    throw new Error('nCr / nPr need whole numbers with 0 ≤ r ≤ n ≤ 170.');
  if (!permutation) r = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < r; i++) result = finite((result * (n - i)) / (permutation ? 1 : i + 1));
  return Math.round(result);
}

export function evaluateMathbo(expression: string, source: number): number {
  if (typeof expression !== 'string' || !expression.trim()) throw new Error('Enter an expression.');
  if (expression.length > 160) throw new Error('Use at most 160 characters.');
  const text = expression.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
  const tokens: string[] = [];
  let position = 0;
  while (position < text.length) {
    if (/\s/.test(text[position])) {
      position++;
      continue;
    }
    const token = text
      .slice(position)
      .match(/^(?:\d+(?:\.\d*)?|\.\d+|log10|log2|sqrt|abs|nCr|nPr|[+\-*/^!(),])/i)?.[0];
    if (!token) throw new Error('Use numbers and the supported math operations only.');
    tokens.push(token);
    position += token.length;
    if (tokens.length > 100) throw new Error('Use a shorter expression.');
  }
  let index = 0,
    depth = 0;
  const take = (token: string) => tokens[index] === token && (++index, true);
  const expect = (token: string) => {
    if (!take(token)) throw new Error(`Expected “${token}”.`);
  };
  function sum(): Node {
    let node = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++];
      node = { kind: 'binary', op, left: node, right: product() };
    }
    return node;
  }
  function product(): Node {
    let node = unary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++];
      node = { kind: 'binary', op, left: node, right: unary() };
    }
    return node;
  }
  function unary(): Node {
    if (++depth > 24) throw new Error('Use fewer nested operations.');
    let node: Node;
    if (take('-')) {
      const argument = unary();
      node = { kind: 'unary', argument };
    } else node = power();
    depth--;
    return node;
  }
  function power(): Node {
    let node = primary();
    while (take('!')) node = { kind: 'factorial', argument: node };
    if (take('^')) node = { kind: 'binary', op: '^', left: node, right: unary() };
    return node;
  }
  function primary(): Node {
    const token = tokens[index++];
    if (!token) throw new Error('Complete the expression.');
    if (/^(?:\d|\.)/.test(token)) return { kind: 'number', value: finite(Number(token)) };
    if (token === '(') {
      const node = sum();
      expect(')');
      return node;
    }
    const name = token.toLowerCase();
    if (!['log2', 'log10', 'sqrt', 'abs', 'ncr', 'npr'].includes(name))
      throw new Error('Choose a number, a function, or parentheses.');
    expect('(');
    const args = [sum()];
    if (take(',')) args.push(sum());
    expect(')');
    if (args.length !== (name === 'ncr' || name === 'npr' ? 2 : 1))
      throw new Error(
        `${token} needs ${name === 'ncr' || name === 'npr' ? 'two arguments' : 'one argument'}.`,
      );
    return { kind: 'function', name, args };
  }
  const root = sum();
  if (index !== tokens.length) throw new Error('Put an operator between numbers or parentheses.');
  const literal = (node: Node) =>
    node.kind === 'number'
      ? node.value
      : node.kind === 'unary' && node.argument.kind === 'number'
        ? -node.argument.value
        : undefined;
  function containsCard(node: Node): boolean {
    if (literal(node) === source) return true;
    if (node.kind === 'unary' || node.kind === 'factorial') return containsCard(node.argument);
    if (node.kind === 'binary') return containsCard(node.left) || containsCard(node.right);
    if (node.kind === 'function') return node.args.some(containsCard);
    return false;
  }
  const values = new Map<Node, number>();
  function calculate(node: Node): number {
    const cached = values.get(node);
    if (cached !== undefined) return cached;
    const result = compute(node);
    values.set(node, result);
    return result;
  }
  function compute(node: Node): number {
    if (node.kind === 'number') return node.value;
    if (node.kind === 'unary') return finite(-calculate(node.argument));
    if (node.kind === 'factorial') return factorial(calculate(node.argument));
    if (node.kind === 'binary') {
      if (
        (node.op === '+' || node.op === '-') &&
        (!containsCard(node.left) || !containsCard(node.right))
      )
        throw new Error(`Both sides of every + or − must contain your card number (${source}).`);
      const a = calculate(node.left),
        b = calculate(node.right);
      if (node.op === '/' && b === 0) throw new Error('Division by zero is not allowed.');
      if (node.op === '^' && b === 0)
        throw new Error(
          'Zero exponents are not allowed, including expressions that evaluate to zero.',
        );
      return finite(
        node.op === '+'
          ? a + b
          : node.op === '-'
            ? a - b
            : node.op === '*'
              ? a * b
              : node.op === '/'
                ? a / b
                : Math.pow(a, b),
      );
    }
    const [a, b] = node.args.map(calculate);
    if ((node.name === 'log2' || node.name === 'log10') && a <= 0)
      throw new Error('Logarithms need a positive number.');
    if (node.name === 'sqrt' && a < 0) throw new Error('Square roots need a nonnegative number.');
    return finite(
      node.name === 'log2'
        ? Math.log2(a)
        : node.name === 'log10'
          ? Math.log10(a)
          : node.name === 'sqrt'
            ? Math.sqrt(a)
            : node.name === 'abs'
              ? Math.abs(a)
              : combinatorics(a, b, node.name === 'npr'),
    );
  }
  const result = calculate(root);
  if (!containsCard(root))
    throw new Error(`Use your selected card number (${source}) at least once.`);
  const paddingError = () => {
    throw new Error('Do not cancel the card into 1 to pad a free-number expression.');
  };
  const unit = (n: number) => Math.abs(Math.abs(n) - 1) <= 1e-9;
  const productNode = (node: Node) =>
    node.kind === 'binary' && (node.op === '*' || node.op === '/');
  function rejectPadding(node: Node, insideProduct = false) {
    if (productNode(node) && !insideProduct) {
      const factors: { node: Node; inverse: boolean }[] = [];
      function collect(term: Node, inverse: boolean) {
        if (term.kind === 'binary' && term.op === '*') {
          collect(term.left, inverse);
          collect(term.right, inverse);
        } else if (term.kind === 'binary' && term.op === '/') {
          collect(term.left, inverse);
          collect(term.right, !inverse);
        } else if (term.kind === 'unary' && literal(term) !== source)
          collect(term.argument, inverse);
        else factors.push({ node: term, inverse });
      }
      collect(node, false);
      const cardFactors = factors.filter((f) => containsCard(f.node));
      const freeFactors = factors.filter((f) => !containsCard(f.node));
      // A literal Ace (1) or red king (-1) is a real card, not a cancellation.
      const naturalUnit = cardFactors.length === 1 && literal(cardFactors[0].node) === source;
      // Flatten the whole product/quotient so regrouping (6*9)/6 cannot hide
      // the same cancellation as (6/6)*9. Logs avoid overflowing partial ratios.
      const cardLog = cardFactors.reduce(
        (sum, f) => sum + (f.inverse ? -1 : 1) * Math.log(Math.abs(calculate(f.node))),
        0,
      );
      if (
        cardFactors.length &&
        !naturalUnit &&
        Math.abs(cardLog) <= 1e-9 &&
        freeFactors.some((f) => !unit(calculate(f.node)))
      )
        paddingError();
    }
    if (node.kind === 'binary') {
      // The same identity can otherwise be smuggled in as a power of one.
      if (
        node.op === '^' &&
        !containsCard(node.left) &&
        containsCard(node.right) &&
        calculate(node.right) === 1 &&
        literal(node.right) !== source
      )
        paddingError();
      rejectPadding(node.left, productNode(node));
      rejectPadding(node.right, productNode(node));
    } else if (node.kind === 'unary') rejectPadding(node.argument, insideProduct);
    else if (node.kind === 'factorial') rejectPadding(node.argument);
    else if (node.kind === 'function') node.args.forEach((arg) => rejectPadding(arg));
  }
  rejectPadding(root);
  return result;
}

export function checkMathbo(expression: string, source: number, target: number) {
  const result = evaluateMathbo(expression, source);
  if (Math.abs(result - target) > 1e-9 * Math.max(1, Math.abs(target)))
    throw new Error(`Your expression gives ${Number(result.toPrecision(10))}, not ${target}.`);
  return result;
}

// Computers only attempt simple expressions based on cards they remember.
export function simpleMathbo(source: number, target: number): string | undefined {
  const n = source < 0 ? `(${source})` : String(source);
  const candidates = [
    String(source),
    `${n}*2`,
    `${n}/2`,
    `${n}^2`,
    `${n}!`,
    `log2(${n})`,
    `log10(${n})`,
    `sqrt(${n})`,
    `${n}+${n}`,
    `${n}-${n}/${n}`,
    `${n}+${n}/${n}`,
    `${n}/${n}`,
  ];
  return candidates.find((expression) => {
    try {
      checkMathbo(expression, source, target);
      return true;
    } catch {
      return false;
    }
  });
}
