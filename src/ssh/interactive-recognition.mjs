export const isRouterPrompt = (value) =>
  /(?:^|\n)[A-Za-z0-9._-]+@[A-Za-z0-9._:-]+(?::~\$|#)\s*$/.test(value);

export function isPagerPrompt(value) {
  const returnPager = /No next tag\s*\(press RETURN\)/i.test(value);
  return {
    found: /(?:^|\n):\s*$/.test(value) || /--More--\s*$/i.test(value) || returnPager,
    returnPager,
  };
}

export const isCommitPrompt = (value) => /Proceed\s*\?\s*\[Y\/n\]/i.test(value);
