const { expect } = require("chai");
const mongoose = require("mongoose");

const processQuery = require("../index");

describe("Basic test", () => {
  it("should works with basic attributes", () => {
    const schema = new mongoose.Schema({ name: String });
    const model = mongoose.model("schema", schema);

    const sufixes = "lt lte gt gte regex regexi in nin eq ne".split(" ");
    const query = sufixes.reduce(
      (obj, sufix) => ({ ...obj, [`name_${sufix}`]: sufix }),
      {
        _limit: 10,
        _start: 50,
        _sort: "name",
        _order: "-1",
        _select: "-name"
      }
    );

    const aggregation = processQuery(model.schema, query);

    sufixes.forEach((sufix) => {
      if (sufix.match(/regexi?/)) {
        const options = sufix === "regexi" ? { $options: "i" } : {};
        expect(aggregation).to.deep.include({
          $match: { name: { $regex: sufix, ...options } },
        });
      } else if (sufix.match(/n?in/)) {
        expect(aggregation).to.deep.include({
          $match: { name: { [`$${sufix}`]: [sufix] } },
        });
      } else {
        expect(aggregation).to.deep.include({
          $match: { name: { [`$${sufix}`]: sufix } },
        });
      }
    });

    expect(aggregation).to.deep.include({ $skip: 50 });
    expect(aggregation).to.deep.include({ $limit: 10 });
    expect(aggregation).to.deep.include({ $sort: { name: -1 } });
    expect(aggregation).to.deep.include({ $project: { name: 0 } });
  });
});
