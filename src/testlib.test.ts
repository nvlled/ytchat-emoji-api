import addOne from "./testlib2";
test("add one", () => {
  expect(addOne(1)).toStrictEqual(2);
  expect(addOne(10)).toStrictEqual(11);
});
