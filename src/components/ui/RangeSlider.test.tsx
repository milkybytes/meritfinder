// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RangeSlider } from "./RangeSlider";

function setup(initial = 50) {
  const utils = render(
    <form>
      <RangeSlider name="range" label="Range" min={1} max={300} initial={initial} unit="ly" />
    </form>,
  );
  const slider = screen.getByRole("slider") as HTMLInputElement;
  const box = screen.getByRole("spinbutton") as HTMLInputElement;
  const form = utils.container.querySelector("form")!;
  return { slider, box, form, ...utils };
}

describe("RangeSlider", () => {

  it("moves the slider when a number is typed", () => {
    const { slider, box } = setup(50);
    fireEvent.change(box, { target: { value: "180" } });
    expect(slider.value).toBe("180");
  });

  it("holds a number that is too big or too small to the ends of the slider, when you leave the box", () => {
    const { slider, box } = setup(50);
    fireEvent.change(box, { target: { value: "9999" } });
    expect(slider.value).toBe("300");
    fireEvent.blur(box);
    expect(box.value).toBe("300");
    fireEvent.change(box, { target: { value: "0" } });
    fireEvent.blur(box);
    expect(box.value).toBe("1");
  });

});
