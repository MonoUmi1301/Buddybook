import { describe, expect, it } from "vitest";
import { classifyNeo4jError, describeNeo4jTarget } from "@/lib/neo4j";

const neoError = (code: string, message = "boom") => Object.assign(new Error(message), { code });

describe("classifyNeo4jError", () => {
  it("recognises the client-side transaction timeout", () => {
    const r = classifyNeo4jError(
      neoError("Neo.ClientError.Transaction.TransactionTimedOutClientConfiguration", "The transaction has been terminated.")
    );
    expect(r.reason).toBe("timeout");
    expect(r.hint).toMatch(/NEO4J_READ_TIMEOUT_MS/);
  });

  it("recognises an unreachable server", () => {
    expect(classifyNeo4jError(neoError("ServiceUnavailable")).reason).toBe("unavailable");
    expect(classifyNeo4jError(new Error("connect ECONNREFUSED 127.0.0.1:7687")).reason).toBe("unavailable");
  });

  it("recognises bad credentials", () => {
    expect(classifyNeo4jError(neoError("Neo.ClientError.Security.Unauthorized")).reason).toBe("auth");
  });

  it("recognises a missing database", () => {
    expect(classifyNeo4jError(neoError("Neo.ClientError.Database.DatabaseNotFound")).reason).toBe("database_not_found");
  });

  it("falls back to a generic reason with the first line of the message", () => {
    const r = classifyNeo4jError(neoError("Neo.ClientError.Statement.SyntaxError", "bad cypher\nat line 3"));
    expect(r.reason).toBe("error");
    expect(r.hint).toBe("Neo.ClientError.Statement.SyntaxError: bad cypher");
  });
});

describe("describeNeo4jTarget", () => {
  it("never includes the password", () => {
    const target = describeNeo4jTarget();
    expect(target).toMatch(/user=/);
    expect(target).not.toContain(process.env.NEO4J_PASSWORD ?? "unset-password");
  });
});
