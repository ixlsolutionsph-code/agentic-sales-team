import { describe, expect, it } from "vitest";
import { normHeader, parseCSV, readTable } from "@/lib/csv";
import { platformOf, safeUrl } from "@/lib/url/safeUrl";
import {
  MSG_PRODUCT_CSV_EMPTY,
  MSG_PRODUCT_CSV_TOO_BIG,
  MSG_PRODUCT_NAME,
  cleanProduct,
  embeddingText,
  keywordTerms,
  mergeSearch,
  productsFromCSV,
} from "./shape";

describe("CSV reading", () => {
  it("handles quotes, commas, line breaks inside quotes, CRLF, BOM and blank lines", () => {
    const text = '﻿name,desc\r\n"Plan, Pro","Line 1\nLine ""2"""\r\n\r\nBasic,Cheap\n';
    expect(parseCSV(text)).toEqual([
      ["name", "desc"],
      ["Plan, Pro", 'Line 1\nLine "2"'],
      ["Basic", "Cheap"],
    ]);
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV("a,b")).toEqual([["a", "b"]]);
  });

  it("matches headers loosely and keeps other columns as extras", () => {
    expect(normHeader(" Short_Description ")).toBe("short description");
    const t = readTable("Title,Cost,Location\nA,1,Manila", { name: ["name", "title"], price: ["price", "cost"] });
    expect(t.hasHeader).toBe(true);
    expect(t.rows).toEqual([{ known: { name: "A", price: "1" }, extra: { Location: "Manila" } }]);
  });
});

describe("products", () => {
  it("cleans one product and requires a name", () => {
    expect(cleanProduct({ name: "  " })).toBe(MSG_PRODUCT_NAME);
    expect(cleanProduct({ name: " Pro ", price: " $9 ", attributes: { " size ": " L ", empty: " ", __proto__: "x" } })).toEqual({
      name: "Pro",
      description: "",
      price: "$9",
      category: "",
      attributes: { size: "L" },
    });
  });

  it("reads a product CSV with aliases; extra columns become attributes", () => {
    const csv = "Product Name,Short Description,Cost,Type,Location\nNurse Pack,Night shift nurses,₱5000,Staffing,Manila\n,No name,1,x,y";
    const out = productsFromCSV(csv);
    expect(out).toEqual({
      products: [
        { name: "Nurse Pack", description: "Night shift nurses", price: "₱5000", category: "Staffing", attributes: { Location: "Manila" } },
      ],
      skipped: 1,
    });
  });

  it("refuses an empty file, one with no known header, and more than 200 rows", () => {
    expect(productsFromCSV("")).toBe(MSG_PRODUCT_CSV_EMPTY);
    expect(productsFromCSV("foo,bar\n1,2")).toBe(MSG_PRODUCT_CSV_EMPTY);
    const big = "name\n" + Array.from({ length: 201 }, (_, i) => `P${i}`).join("\n");
    expect(productsFromCSV(big)).toBe(MSG_PRODUCT_CSV_TOO_BIG);
    const ok = "name\n" + Array.from({ length: 200 }, (_, i) => `P${i}`).join("\n");
    expect((productsFromCSV(ok) as { products: unknown[] }).products).toHaveLength(200);
  });

  it("builds the embedding text: name, category, description, then key: value", () => {
    expect(embeddingText({ name: "A", category: "C", description: "D", attributes: { location: "Manila" } })).toBe("A\nC\nD\nlocation: Manila");
    expect(embeddingText({ name: "A", category: "", description: "", attributes: {} })).toBe("A");
  });

  it("merges meaning and keyword matches without repeats, up to k", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const c = { id: "c" };
    expect(mergeSearch([a, b], [b, c], 3)).toEqual([a, b, c]);
    expect(mergeSearch([a, b], [c], 2)).toEqual([a, b]);
    expect(mergeSearch([], [c], 5)).toEqual([c]);
    expect(keywordTerms("HR staff for a hospital, hospital")).toEqual(["staff", "hospital"]);
    expect(keywordTerms("someone to answer customer emails")).toEqual(["answer", "customer", "emails"]);
  });
});

describe("safe links", () => {
  it("keeps only http(s) links and names the platform", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl(" https://example.com/a ")).toBe("https://example.com/a");
    expect(platformOf("https://www.linkedin.com/in/x")).toBe("LinkedIn");
    expect(platformOf("https://old.reddit.com/r/x")).toBe("Reddit");
    expect(platformOf("https://x.com/a")).toBe("X");
    expect(platformOf("https://m.facebook.com/a")).toBe("Facebook");
    expect(platformOf("https://example.com")).toBe("web");
    expect(platformOf("ftp://x")).toBeNull();
  });
});
