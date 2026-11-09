import { describe, expect, it } from "vitest"
import { parseCsvRows } from "./csv"

describe("parseCsvRows", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("handles quoted fields with commas and escaped quotes", () => {
    const csv = 'phase,task\n"Discovery","Define scope, milestones"\n"Build","Say ""hello"""'
    expect(parseCsvRows(csv)).toEqual([
      ["phase", "task"],
      ["Discovery", "Define scope, milestones"],
      ["Build", 'Say "hello"'],
    ])
  })

  it("handles CRLF and drops empty rows", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n\r\n3,4\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ])
  })

  it("handles a quoted field spanning a newline", () => {
    const csv = 'id,note\n1,"line1\nline2"'
    expect(parseCsvRows(csv)).toEqual([
      ["id", "note"],
      ["1", "line1\nline2"],
    ])
  })
})
