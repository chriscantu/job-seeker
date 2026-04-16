"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { classifySender } = require("../scripts/lib/sender-classifier");

// --- Known domain lists (high confidence) ---

test("classifier: glassdoor.com → job-alert / high", () => {
  const result = classifySender({
    domain: "glassdoor.com",
    fromAddresses: ["noreply@glassdoor.com"],
    messageCount: 6,
    subjects: ["6 new VP Engineering jobs in Austin"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: indeed.com → job-alert / high", () => {
  const result = classifySender({
    domain: "indeed.com",
    fromAddresses: ["alert@indeed.com"],
    messageCount: 3,
    subjects: ["New jobs for VP Engineering"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: wellfound.com → job-alert / high", () => {
  const result = classifySender({
    domain: "wellfound.com",
    fromAddresses: ["team@hi.wellfound.com"],
    messageCount: 4,
    subjects: ["Your weekly job digest"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: lensa.com → staffing / high", () => {
  const result = classifySender({
    domain: "lensa.com",
    fromAddresses: ["jobs@lensa.com"],
    messageCount: 2,
    subjects: ["New matches for you"],
  });
  assert.equal(result.suggestedCategory, "staffing");
  assert.equal(result.confidence, "high");
});

test("classifier: topresume.com → marketing / high", () => {
  const result = classifySender({
    domain: "topresume.com",
    fromAddresses: ["andrew@topresume.com"],
    messageCount: 5,
    subjects: ["Your resume review is ready"],
  });
  assert.equal(result.suggestedCategory, "marketing");
  assert.equal(result.confidence, "high");
});

// --- Heuristic signals (medium confidence) ---

test("classifier: noreply@ from unknown domain with high count → medium", () => {
  const result = classifySender({
    domain: "unknownplatform.io",
    fromAddresses: ["noreply@unknownplatform.io"],
    messageCount: 8,
    subjects: ["Your weekly update", "Your weekly update", "Your weekly update"],
  });
  assert.equal(result.confidence, "medium");
  assert.notEqual(result.suggestedCategory, "unknown");
});

test("classifier: notifications@ from unknown domain with 5+ messages → medium", () => {
  const result = classifySender({
    domain: "someservice.com",
    fromAddresses: ["notifications@someservice.com"],
    messageCount: 5,
    subjects: ["Update 1", "Update 2", "Update 3", "Update 4", "Update 5"],
  });
  assert.equal(result.confidence, "medium");
});

// --- Fallback (low confidence) ---

test("classifier: unknown domain, low count, no signals → unknown / low", () => {
  const result = classifySender({
    domain: "randomcompany.com",
    fromAddresses: ["jane@randomcompany.com"],
    messageCount: 1,
    subjects: ["Following up on our conversation"],
  });
  assert.equal(result.suggestedCategory, "unknown");
  assert.equal(result.confidence, "low");
});

// --- Edge cases ---

test("classifier: subdomain of known domain does NOT match (notglassdoor.com)", () => {
  const result = classifySender({
    domain: "notglassdoor.com",
    fromAddresses: ["hi@notglassdoor.com"],
    messageCount: 1,
    subjects: ["Hello"],
  });
  assert.notEqual(result.confidence, "high");
});

test("classifier: mail subdomain of known domain DOES match (mail.glassdoor.com)", () => {
  const result = classifySender({
    domain: "mail.glassdoor.com",
    fromAddresses: ["noreply@mail.glassdoor.com"],
    messageCount: 3,
    subjects: ["New jobs"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});
