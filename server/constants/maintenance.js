// Shared maintenance-plan constants so every endpoint interprets plan state the same way.

const MAINTENANCE_TYPE = Object.freeze({
  PERIODIC: 'periodic',
  ONE_TIME: 'one-time',
});

// A periodic plan is considered in effect when it is either auto-activated ('Active')
// or explicitly approved ('Approved').
const ACTIVE_PERIODIC_STATUSES = Object.freeze(['Approved', 'Active']);

// SQL fragment for use in WHERE clauses, e.g. `status IN ${ACTIVE_PERIODIC_STATUSES_SQL}`.
const ACTIVE_PERIODIC_STATUSES_SQL = `(${ACTIVE_PERIODIC_STATUSES.map((s) => `'${s}'`).join(', ')})`;

module.exports = {
  MAINTENANCE_TYPE,
  ACTIVE_PERIODIC_STATUSES,
  ACTIVE_PERIODIC_STATUSES_SQL,
};
