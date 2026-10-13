// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RingedPlanetImage } from "./markers/RingedPlanetIcon";
import { StationIcon } from "./StationIcon";

describe("icon styling", () => {
  it("draws a station icon white, with the same glow as the other pictures, as an inline style", () => {
    const { container } = render(<StationIcon type="Coriolis Starport" size={16} />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.filter).toContain("brightness(0)");
    expect(svg.style.filter).toContain("invert(1)");
    expect(svg.style.filter).toContain("drop-shadow");
    expect(svg.getAttribute("aria-label")).toBe("Coriolis Starport");
  });

  it("renders nothing for a station type with no icon", () => {
    const { container } = render(<StationIcon type="Fleet Carrier" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("gives the ringed planet no browser tooltip unless it is given a label", () => {
    const plain = render(<RingedPlanetImage size={16} />).container;
    expect(plain.querySelector("title")).toBeNull();
    const labelled = render(<RingedPlanetImage size={16} alt="Ringed planet" />).container;
    expect(labelled.querySelector("title")?.textContent).toBe("Ringed planet");
  });
});
