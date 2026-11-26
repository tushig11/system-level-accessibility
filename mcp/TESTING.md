# Testing the MCP server on your product

Thank you for trying it. This takes about 30 minutes. Your honest feedback, including what did not work, is what makes the tool better.

## What it does

- Lets you describe your team's accessibility practices and shows which of the six layers has the most gaps, with a first step for each.
- Reviews a snippet of HTML, JSX or TSX for common markup mistakes and explains how to prevent them in a shared component.
- Generates starting files: a CI check, a pull request template, a Definition of Done, and a manual test script.
- Gives an AI coding assistant rules for generating UI, and a loop to check its own output.

## What it does not do

- It does not measure accessibility or WCAG conformance. The assessment is a self-report of practices.
- It does not run your site. The markup review is a heuristic on the snippet you give it.
- It does not replace axe in CI or testing with a keyboard and a screen reader.

## Set up

Follow the install steps in the [README](README.md), then restart your assistant.

## Try these

1. Ask: "Use the system-level accessibility tools to assess our team." Answer for your team honestly.
2. Paste a component from your product and ask for a review. Note which findings are right and which are wrong.
3. Ask for the enforcement files that fit your setup. Try one.
4. If you use an AI coding assistant, ask it to build a small UI with the `generate-accessible-ui` prompt.

## Send feedback

Open an issue with the [tester feedback form](../../../issues/new?template=tester-feedback.yml). Please include:

- What you tried it on (kind of product and stack, not a company secret).
- Which layer it said was weakest, and whether that matched what you already knew.
- Findings that were wrong or missed.
- Anything you changed because of it, and anything you would not trust it for.

Feedback is published in the issue tracker, so leave out anything private.

You can also email feedback if you prefer not to post publicly. Say so, and tell us whether we may quote it.
