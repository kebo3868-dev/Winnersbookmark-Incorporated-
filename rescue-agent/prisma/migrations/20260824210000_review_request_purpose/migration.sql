-- Review requests become a sendable message purpose (Review Request Activation).
--
-- Until now FdReviewRequest rows could be recorded but never sent, because
-- every outbound message goes through queueMessage and queueMessage requires a
-- purpose from this enum. Adding the value is what activates the SMS channel.
--
-- The purpose is deliberately its own value rather than reusing
-- CONVERSATION_REPLY. Three things depend on being able to tell them apart:
-- consent and the follow-up cap treat it as customer-directed, the failure
-- queue names it when a send is blocked, and an operator auditing what a
-- restaurant sent needs review solicitation to be distinguishable from a reply
-- the customer asked for.
--
-- ADDITIVE ONLY. One new enum value; no column, table, index or constraint is
-- added to, altered on, or dropped from any existing object. Existing rows are
-- untouched and every existing value keeps its meaning.

ALTER TYPE "FdMessagePurpose" ADD VALUE 'REVIEW_REQUEST';
