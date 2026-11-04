import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-mock="button">{children}</div>
  ),
}));

vi.mock("../context/usePoseContext", () => ({
  default: () => ({ videoRef: { current: null }, streamReady: true }),
}));

import CardLayout from "../components/CardLayout";

describe("CardLayout", () => {
  it("renders loading state", () => {
    const html = renderToStaticMarkup(
      <CardLayout
        title="Test"
        loading
        isEmpty={false}
        loadingMessage="Loading..."
        emptyMessage="Empty"
        errorPrefix="Error"
        hasPrevious={false}
        hasNext={false}
        onPrevious={() => {}}
        onNext={() => {}}
        slots={[]}
        transitionDirection="forward"
        transitionKey="k"
        footerButtonLabel="Save"
        footerButtonOnAction={() => {}}
      />,
    );

    expect(html).toContain("Loading...");
    expect(html).toContain("Test");
  });

  it("renders card and action slots", () => {
    const html = renderToStaticMarkup(
      <CardLayout
        title="Cards"
        loading={false}
        isEmpty={false}
        loadingMessage="Loading..."
        emptyMessage="Empty"
        errorPrefix="Error"
        hasPrevious={false}
        hasNext={false}
        onPrevious={() => {}}
        onNext={() => {}}
        slots={[<div key="c1">Card 1</div>]}
        actionSlots={[<div key="a1">Action 1</div>]}
        transitionDirection="forward"
        transitionKey="k"
        footerButtonLabel="Save"
        footerButtonOnAction={() => {}}
      />,
    );

    expect(html).toContain("Card 1");
    expect(html).toContain("Action 1");
    expect(html).toContain("Save");
  });
});
