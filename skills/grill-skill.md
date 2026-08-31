# Feature Grilling Skill Document

## 1. Purpose

The purpose of this skill is to systematically grill a feature before implementation, during development, and before release.

The goal is **not** to understand only how the feature works in the happy path.

The goal is to uncover:

* Missing requirements
* Hidden assumptions
* Unhandled edge cases
* Failure scenarios
* Dependency risks
* Data inconsistencies
* Concurrency issues
* Performance problems
* Security concerns
* Operational problems
* Deployment and rollback risks
* Scenarios that the original feature design did not consider

A feature should be considered well understood only when we can explain:

> **What happens when everything goes right, what happens when something goes wrong, and what happens when something unexpected happens?**

---

# 2. Grilling Philosophy

For every feature, follow this mindset:

### Don't ask only:

> "How does this feature work?"

Also ask:

> "What can break?"

> "What happens if this assumption is false?"

> "What happens if the input is unexpected?"

> "What happens if the dependency is unavailable?"

> "What happens if this happens twice?"

> "What happens if this happens simultaneously?"

> "What happens if the system crashes at this exact point?"

> "How do we recover?"

> "How do we know that it happened?"

> "What happens to existing users/data?"

---

# 3. Feature Onboarding

Before grilling edge cases, first establish a complete understanding of the feature.

## 3.1 Feature Overview

Ask:

1. What exactly is this feature?
2. What problem does it solve?
3. Why do we need this feature?
4. Who is the consumer/user of this feature?
5. What was the behavior before this feature?
6. What changes after introducing this feature?
7. What is explicitly out of scope?
8. What assumptions are we making?
9. What are the success criteria?
10. How will we know the feature is working correctly?

### Grill:

* Can you explain the feature in 2 minutes?
* Can you explain it without using implementation-specific terminology?
* What is the single most important thing this feature is supposed to accomplish?
* If we remove this feature, what breaks?
* What problem are we actually solving?
* Are there any requirements that are ambiguous?

---

# 4. User / Consumer Journey

Understand the complete lifecycle.

Map:

**Trigger → Input → Processing → Dependencies → State Change → Output → Consumer**

Ask:

1. What triggers the feature?
2. Who triggers it?
3. What input is provided?
4. What validation happens?
5. What processing happens?
6. Which services/components are involved?
7. Which databases/storage systems are involved?
8. What state changes?
9. What is returned/output?
10. What happens after the operation completes?

### Grill:

* What is the first thing that happens?
* What is the last thing that happens?
* What happens between those two points?
* Which component owns each responsibility?
* Where can the flow fail?
* Where can the flow become inconsistent?

---

# 5. Preconditions

Identify everything that must be true before the feature can execute.

Ask:

1. Does the user need permission?
2. Does a configuration need to exist?
3. Does data need to exist beforehand?
4. Does another service need to be running?
5. Does a specific version need to be deployed?
6. Does the database need a particular schema?
7. Does the environment require special configuration?
8. Are there feature flags?
9. Are there external dependencies?

### Grill:

* What happens if a precondition is missing?
* Is the precondition validated?
* Where is it validated?
* What happens if the validation itself fails?
* Can the system reach an invalid state despite the precondition?

---

# 6. Inputs

Grill every input.

For each input determine:

* Type
* Format
* Required/optional
* Default value
* Allowed values
* Maximum/minimum value
* Length
* Nullability
* Encoding
* Case sensitivity
* Uniqueness
* Validation rules

### Questions

1. What happens if the input is null?
2. What happens if the input is empty?
3. What happens if the input is missing?
4. What happens if the input has an invalid format?
5. What happens if the input is extremely large?
6. What happens if the input contains unexpected characters?
7. What happens if the same input is submitted twice?
8. What happens if the input contains unexpected combinations of otherwise valid values?

### Boundary Testing

Always test:

* Minimum valid value
* Maximum valid value
* One below minimum
* One above maximum
* Empty value
* Null value
* Missing value
* Duplicate value
* Extremely large value

---

# 7. Happy Path

Document the expected successful flow.

Example:

**Request**
→ Validate request
→ Fetch data
→ Process data
→ Call dependency
→ Persist result
→ Return response

For every step ask:

1. What happens here?
2. What input does this step receive?
3. What output does it produce?
4. What can fail?
5. What happens if it fails?
6. Is the operation retryable?
7. Is the operation idempotent?

---

# 8. Failure Grilling

For every operation, ask:

> "What happens if this fails?"

Check failures at:

* Input validation
* Authentication
* Authorization
* Database
* Cache
* API
* Network
* File system
* Message queue
* External service
* Configuration
* Serialization/deserialization
* Business logic
* Application process
* Infrastructure

For each failure determine:

**Failure → Detection → Handling → Retry → Recovery → User impact → Logging/Alerting**

---

# 9. Dependency Grilling

List every dependency.

For each dependency ask:

1. What do we depend on?
2. Why do we depend on it?
3. What happens if it is unavailable?
4. What happens if it is slow?
5. What happens if it returns an unexpected response?
6. What happens if it returns partial data?
7. What happens if it returns corrupted data?
8. What happens if it changes its API?
9. What happens if it times out?
10. What happens if it returns an error?
11. Do we retry?
12. How many times?
13. What is the retry backoff?
14. Could retries overload the dependency?
15. Is a fallback available?

### Important:

Never assume:

> "The dependency will always work."

Grill:

> "What happens when it doesn't?"

---

# 10. Timeout Grilling

For every network or external operation ask:

1. Is there a timeout?
2. What is the timeout value?
3. Why was that value selected?
4. What happens after timeout?
5. Is the request retried?
6. Could the original request still be executing?
7. Can retry cause duplicate processing?
8. How do we know whether the original request succeeded?

### Classic Scenario

Request is sent.

The server processes it successfully.

The response is lost.

Client assumes failure and retries.

Ask:

> **Can this create duplicate processing?**

If yes:

> **How do we prevent it?**

---

# 11. Retry Grilling

For every failure ask:

> "Should we retry?"

Do not blindly retry everything.

Determine whether the operation is:

* Retryable
* Non-retryable
* Idempotent
* Non-idempotent

Ask:

1. What errors are retryable?
2. What errors should immediately fail?
3. How many retries?
4. Fixed or exponential backoff?
5. Is jitter used?
6. What happens after all retries fail?
7. Can retries create duplicates?
8. Can retries create a retry storm?
9. Can multiple instances retry simultaneously?

---

# 12. Idempotency

Ask:

> "What happens if the same request arrives twice?"

Test:

* Duplicate API request
* Duplicate message
* Duplicate event
* Client retry
* Network retry
* User clicking twice
* Consumer processing the same message twice

Ask:

1. Is the operation idempotent?
2. If not, how is duplication prevented?
3. Is there an idempotency key?
4. Where is it stored?
5. How long is it retained?
6. What happens if two identical requests arrive simultaneously?

---

# 13. Concurrency Grilling

Never assume requests happen sequentially.

Ask:

1. What happens if two requests modify the same resource simultaneously?
2. What happens if two users perform the same operation at the same time?
3. What happens if two consumers process the same event?
4. Can race conditions occur?
5. Are database transactions used?
6. Are locks required?
7. What type of consistency is required?
8. Can stale data overwrite newer data?

### Classic Scenario

Initial value = 10.

Request A reads 10.

Request B reads 10.

A updates to 20.

B updates to 15.

Final value = 15.

Ask:

> Was A's update lost?

If yes:

> How do we prevent lost updates?

---

# 14. State Transition Grilling

Identify every possible state.

Example:

**CREATED → PROCESSING → COMPLETED**

Then ask:

1. Can CREATED go directly to COMPLETED?
2. What happens if PROCESSING fails?
3. Can PROCESSING happen twice?
4. Can COMPLETED go back to PROCESSING?
5. What happens if the service crashes during PROCESSING?
6. Who owns the state transition?
7. How is an invalid state prevented?
8. Can two processes change the state simultaneously?

For every state transition ask:

> **What happens if the system crashes immediately before and immediately after this transition?**

---

# 15. Partial Failure

Partial failure is one of the most important areas to grill.

Example:

A feature performs:

**A → B → C → D**

A and B succeed.

C succeeds.

D fails.

Ask:

1. What state are we left in?
2. Can we roll back A/B/C?
3. Do we need compensation?
4. Can the operation be safely retried?
5. Will retry repeat A/B/C?
6. How do we detect partially completed operations?
7. How do we repair them?

### Key Question

> "Can the system end up in a state where some operations succeeded and others failed?"

If yes:

> "How do we recover?"

---

# 16. Database Grilling

Ask:

1. What data is stored?
2. Which tables/collections are affected?
3. Are schema changes required?
4. Are migrations backward compatible?
5. Are indexes required?
6. What happens with duplicate data?
7. What happens if the database is unavailable?
8. What happens if a query times out?
9. Can transactions guarantee consistency?
10. What happens if the application crashes during a transaction?
11. Can partial data be persisted?
12. Can old application versions read the new data?

### Performance

Ask:

* What is the query complexity?
* Which indexes are used?
* Could this cause a full table scan?
* What happens when the table grows 10x?
* What happens when it grows 100x?

---

# 17. Data Consistency

Ask:

1. Which system is the source of truth?
2. Is the data strongly consistent or eventually consistent?
3. How long can stale data exist?
4. Can two systems disagree?
5. How do we reconcile them?
6. What happens if an update succeeds in one system but fails in another?
7. Is there a reconciliation mechanism?

---

# 18. Message Queue / Event Grilling

If messaging is involved, ask:

1. Can messages be duplicated?
2. Can messages arrive out of order?
3. Can messages be delayed?
4. Can messages be lost?
5. What happens if consumer processing fails?
6. Is the message retried?
7. What happens after maximum retries?
8. Is there a dead-letter queue?
9. Is processing idempotent?
10. What happens if an old event arrives after a newer event?

### Important Scenario

Event 2 arrives before Event 1.

Ask:

> Can the system handle out-of-order events?

---

# 19. Backward Compatibility

Ask:

1. Will existing clients continue to work?
2. Will old data continue to work?
3. Will older application versions understand the new data?
4. Are API changes backward compatible?
5. Are database changes backward compatible?
6. Can old and new versions run simultaneously during deployment?

---

# 20. Deployment Grilling

Ask:

1. What changes are required during deployment?
2. Does deployment require downtime?
3. Are database migrations required?
4. Are migrations backward compatible?
5. Can old and new application versions coexist?
6. Is a feature flag used?
7. Can the feature be enabled gradually?
8. What happens if deployment partially succeeds?
9. What happens if deployment fails halfway?

---

# 21. Rollback Grilling

Ask:

> "If we deploy this today and discover a critical bug tomorrow, how exactly do we rollback?"

Then determine:

1. Can application code be rolled back?
2. Can database changes be rolled back?
3. Can configuration be rolled back?
4. Can events/data already generated by the feature be reverted?
5. Will old code understand new data?
6. Do we need a forward fix instead of rollback?

---

# 22. Feature Flag Grilling

If a feature flag exists:

1. What is the default value?
2. Who can change it?
3. Can it be changed without deployment?
4. What happens when it changes during an active request?
5. Is the flag evaluated consistently?
6. What happens if configuration is unavailable?
7. Can we enable it for only a subset of users?
8. How do we disable the feature during an incident?

---

# 23. Performance Grilling

Ask:

1. What is the expected traffic?
2. What is the maximum expected traffic?
3. What happens at 2x traffic?
4. What happens at 10x traffic?
5. What is the expected latency?
6. What is the worst-case latency?
7. What resources does the feature consume?
8. CPU?
9. Memory?
10. Network?
11. Disk I/O?
12. Database connections?
13. External API calls?

### Grill:

> "What happens if traffic suddenly increases by 10x?"

> "What is the first bottleneck?"

> "What fails first?"

> "How does the system degrade?"

---

# 24. Scalability Grilling

Ask:

1. Does the design scale horizontally?
2. Is there any shared state?
3. Is there a single bottleneck?
4. Is there a single point of failure?
5. Does database load scale with traffic?
6. Does dependency traffic scale with traffic?
7. Are there rate limits?
8. What happens when we reach the rate limit?

---

# 25. Security Grilling

Ask:

1. Who can access this feature?
2. How is authentication handled?
3. How is authorization handled?
4. Can one user access another user's data?
5. Is input sanitized?
6. Can malicious input reach downstream systems?
7. Are secrets exposed?
8. Is sensitive information logged?
9. Can requests be replayed?
10. Can users bypass the UI and call the API directly?

### Attack the feature:

> "If I am an unauthorized user, what prevents me from calling this directly?"

---

# 26. Observability Grilling

Ask:

1. What logs are generated?
2. What metrics are generated?
3. What traces are generated?
4. Can we identify failed requests?
5. Can we identify slow requests?
6. Can we identify dependency failures?
7. Are correlation/request IDs available?
8. Are there alerts?
9. What dashboard shows feature health?

### Critical Question

> "The feature is broken in production. How will you know?"

Then:

> "How will you determine why it is broken?"

---

# 27. Logging Grilling

Ask:

1. What should be logged?
2. What should never be logged?
3. Are sensitive values masked?
4. Can we correlate logs across services?
5. Are errors actionable?
6. Do logs contain enough context to debug the issue?

Avoid logging:

* Passwords
* Tokens
* Secrets
* Sensitive personal information
* Authentication credentials

---

# 28. Recovery Grilling

Ask:

1. How does the system recover from failure?
2. Is recovery automatic?
3. Does recovery require manual intervention?
4. Can failed operations be replayed?
5. Can data be repaired?
6. Is there a reconciliation process?
7. How do we identify stuck operations?
8. How do we recover from corrupted state?

---

# 29. Disaster Scenarios

Ask:

### Scenario 1

Database goes down.

What happens?

### Scenario 2

External dependency goes down.

What happens?

### Scenario 3

Network becomes unreliable.

What happens?

### Scenario 4

Application crashes midway.

What happens?

### Scenario 5

Message queue becomes unavailable.

What happens?

### Scenario 6

Traffic increases 10x.

What happens?

### Scenario 7

A dependency starts returning incorrect data.

What happens?

### Scenario 8

Two requests modify the same resource simultaneously.

What happens?

### Scenario 9

The same event is processed twice.

What happens?

### Scenario 10

Events arrive out of order.

What happens?

---

# 30. Configuration Grilling

Ask:

1. What configuration does the feature require?
2. What happens if configuration is missing?
3. What happens if configuration is invalid?
4. What are the defaults?
5. Are environment-specific configurations required?
6. Can configuration change without deployment?
7. What happens when configuration changes while the system is running?

---

# 31. Compatibility Grilling

Check compatibility with:

* Existing APIs
* Existing clients
* Existing database records
* Existing events
* Existing services
* Existing configuration
* Older application versions
* Different environments

Ask:

> "What existing behavior could this feature accidentally break?"

---

# 32. Edge Case Matrix

For every feature, explicitly check:

### Input Edge Cases

* Null
* Empty
* Missing
* Invalid
* Very large
* Very small
* Duplicate
* Unexpected format
* Special characters
* Boundary values

### Request Edge Cases

* Duplicate request
* Concurrent request
* Retry
* Timeout
* Cancelled request
* Request after timeout
* Malformed request

### Data Edge Cases

* Missing data
* Duplicate data
* Corrupted data
* Stale data
* Inconsistent data
* Partial data
* Extremely large dataset

### Dependency Edge Cases

* Dependency unavailable
* Dependency timeout
* Dependency returns 500
* Dependency returns unexpected response
* Dependency returns stale data
* Dependency rate limit
* Dependency API change

### Infrastructure Edge Cases

* Application crash
* Database failure
* Network failure
* Queue failure
* Disk failure
* Memory pressure
* CPU saturation
* Deployment failure

### User Edge Cases

* Unauthorized user
* Multiple users
* User performs action twice
* User abandons operation
* User retries after failure
* User performs actions in unexpected order

---

# 33. The "What If?" Grilling Technique

For every important statement in the design, ask:

> **What if this is not true?**

Examples:

"We assume the API always returns valid data."

→ What if it doesn't?

"We assume the request will only happen once."

→ What if it happens twice?

"We assume the database will be available."

→ What if it goes down?

"We assume events arrive in order."

→ What if they don't?

"We assume the user waits for the response."

→ What if they close the application?

"We assume the operation completes quickly."

→ What if it takes 5 minutes?

This technique should be used aggressively.

---

# 34. Crash Point Analysis

Take the feature flow:

**A → B → C → D → E**

For every transition ask:

> What happens if the application crashes here?

Check:

* Before A
* During A
* After A
* Before B
* During B
* After B
* Before C
* During C
* After C
* Before D
* During D
* After D
* Before E
* During E
* After E

This is particularly important for operations involving:

* Databases
* Payments
* Messages
* External APIs
* File processing
* State transitions

---

# 35. Duplicate Execution Analysis

Ask:

> "What happens if every step executes twice?"

Check:

* API request twice
* Database write twice
* Event twice
* Message twice
* External API call twice
* Job twice
* Scheduled task twice

Determine whether each operation is:

**Safe / Idempotent / Dangerous**

---

# 36. Time-Based Edge Cases

Check:

* Timeout
* Expiration
* Delayed processing
* Clock differences
* Time zone differences
* Daylight saving changes where applicable
* Midnight boundary
* Month boundary
* Year boundary
* Leap year
* Expired data
* Future-dated data

Ask:

> "Does this feature behave differently depending on time?"

---

# 37. Volume-Based Edge Cases

Test:

**0 records**

**1 record**

**Expected number of records**

**Maximum expected records**

**10x expected records**

**Extremely large dataset**

Ask:

> "Does the implementation assume that the dataset is small?"

---

# 38. Production Grilling

Before release ask:

1. How will we deploy it?
2. How will we monitor it?
3. What metrics indicate success?
4. What metrics indicate failure?
5. What alerts exist?
6. How do we disable it?
7. How do we rollback?
8. How do we recover corrupted/partial data?
9. Who owns the feature in production?
10. What is the runbook for incidents?

---

# 39. Final Rapid-Fire Questions

Before approving a feature, ask these questions quickly:

1. What is the biggest failure mode?
2. What is the biggest scalability risk?
3. What is the biggest data consistency risk?
4. What happens if the request comes twice?
5. What happens if two requests come simultaneously?
6. What happens if the dependency is down?
7. What happens if the dependency is slow?
8. What happens if the database is down?
9. What happens if the application crashes midway?
10. What happens if the event is duplicated?
11. What happens if events arrive out of order?
12. What happens if the input is invalid?
13. What happens if the input is extremely large?
14. What happens if the operation partially succeeds?
15. What happens if deployment fails halfway?
16. What happens if rollback is required?
17. What happens to existing data?
18. What happens to existing clients?
19. How do we detect failures?
20. How do we recover from failures?
21. What happens at 10x traffic?
22. What happens when a downstream service changes?
23. What is the single point of failure?
24. What assumption in this design worries you the most?
25. What scenario have we NOT discussed yet?

---

# 40. Feature Readiness Checklist

A feature should not be considered fully understood until the owner can answer:

## Functional

* [ ] Feature purpose is clear
* [ ] User journey is clear
* [ ] Inputs are defined
* [ ] Outputs are defined
* [ ] Preconditions are defined
* [ ] Success criteria are defined
* [ ] Out-of-scope behavior is defined

## Failure Handling

* [ ] Failure scenarios identified
* [ ] Timeout behavior defined
* [ ] Retry behavior defined
* [ ] Partial failure handled
* [ ] Recovery mechanism defined
* [ ] Duplicate execution handled
* [ ] Crash recovery considered

## Data

* [ ] Data model understood
* [ ] Database changes understood
* [ ] Data consistency defined
* [ ] Migration strategy defined
* [ ] Rollback strategy defined
* [ ] Large-data behavior considered

## Concurrency

* [ ] Concurrent requests considered
* [ ] Race conditions considered
* [ ] Duplicate events considered
* [ ] Out-of-order events considered
* [ ] Idempotency considered

## Dependencies

* [ ] All dependencies identified
* [ ] Dependency failure handled
* [ ] Dependency timeout handled
* [ ] Dependency retry strategy defined
* [ ] Dependency rate limits considered

## Performance

* [ ] Expected load defined
* [ ] Maximum load considered
* [ ] Latency requirements defined
* [ ] Resource usage considered
* [ ] Bottlenecks identified

## Security

* [ ] Authentication checked
* [ ] Authorization checked
* [ ] Input validation checked
* [ ] Sensitive data handling checked
* [ ] Direct API abuse considered

## Operations

* [ ] Logging implemented
* [ ] Metrics implemented
* [ ] Tracing implemented where required
* [ ] Alerts defined
* [ ] Dashboard available
* [ ] Production ownership defined
* [ ] Incident recovery documented

## Deployment

* [ ] Deployment strategy defined
* [ ] Feature flag considered
* [ ] Backward compatibility verified
* [ ] Migration strategy defined
* [ ] Rollback/forward-fix strategy defined

---

# 41. Grilling Severity

When an issue is discovered, classify it.

### 🔴 Critical

Can cause:

* Data corruption
* Security breach
* Major outage
* Irrecoverable inconsistency
* Financial/business-critical failure

**Must be addressed before release.**

### 🟠 High

Can cause:

* Significant feature failure
* Large user impact
* Major performance degradation
* Difficult recovery

**Should normally be addressed before release.**

### 🟡 Medium

Can cause:

* Limited user impact
* Recoverable failure
* Operational inconvenience

**Should be tracked and addressed based on priority.**

### 🟢 Low

Minor:

* Usability issue
* Logging improvement
* Non-critical optimization
* Nice-to-have behavior

---

# 42. The Ultimate Feature Grill

At the end of every review, force the feature owner to answer these five questions:

### 1. Happy Path

> "Walk me through exactly what happens when everything works."

### 2. Failure Path

> "Now walk me through what happens when every major dependency fails."

### 3. Edge Path

> "Give me the weirdest valid input and explain what happens."

### 4. Concurrency Path

> "What happens when two identical operations happen simultaneously?"

### 5. Recovery Path

> "The system crashes halfway through. What state are we in, how do we detect it, and how do we recover?"

If these five cannot be answered clearly, the feature is **not fully understood yet**.

---

# 43. Core Principle

The quality of a feature review is not determined by how well we understand the happy path.

It is determined by how well we understand the **unexpected paths**.

Therefore:

> **Understand the feature.**
>
> **Break the feature.**
>
> **Understand how it fails.**
>
> **Understand how it recovers.**
>
> **Then decide whether it is ready.**
