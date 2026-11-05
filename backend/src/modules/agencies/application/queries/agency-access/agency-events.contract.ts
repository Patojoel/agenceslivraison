/**
 * Public API of `agencies` for the modules that react to what happens to an agency (marketplace first): the events of its
 * domain and their guard. Other modules import them from here and from nowhere else in the domain of `agencies`; they
 * read the identifiers the events carry, then ask `AgencyAccessReader` for the state, never the other way round.
 */
export { isAgencyEvent } from '../../../domain/events/agency-events';
export type { AgencyEvent } from '../../../domain/events/agency-events';
