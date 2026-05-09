import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { StatusNotice } from "@/components/link/status-notice";

describe("StatusNotice", () => {
  test("renders a private consumed notice without indexing copy", () => {
    const html = renderToStaticMarkup(
      createElement(StatusNotice, {
        type: "consumed_private",
      }),
    );

    assert.match(html, /Link already used/);
    assert.match(html, /The resulting deal is private/);
    assert.doesNotMatch(html, /Waiting for the deal to be indexed/);
  });
});
