import { Inject, Injectable } from '@nestjs/common';
import { AgencyNotFound } from '../../../domain/exceptions/agency.exceptions';
import { evaluateOnboarding } from '../../../domain/onboarding-requirements';
import { READ_AGENCY_ONBOARDING_REPOSITORY, ReadAgencyOnboardingRepository } from '../../ports/read-agency-onboarding.repository';
import { GetAgencyOnboardingQuery } from './get-agency-onboarding.query';
import { GetAgencyOnboardingResponse } from './get-agency-onboarding.response';

@Injectable()
export class GetAgencyOnboardingHandler {
  constructor(@Inject(READ_AGENCY_ONBOARDING_REPOSITORY) private readonly onboarding: ReadAgencyOnboardingRepository) {}

  async handle(query: GetAgencyOnboardingQuery): Promise<GetAgencyOnboardingResponse> {
    const agency = await this.onboarding.findForMember(query.agencyId, query.userId);
    if (!agency) throw new AgencyNotFound();
    const active = agency.capabilities.filter(capability => capability.state === 'active');
    const evaluation = evaluateOnboarding({ status: agency.status, identity: agency.identity, activeCapabilities: active.length, activeSites: agency.activeSites });
    return {
      status: agency.status,
      submission: agency.submission,
      prerequisites: evaluation.prerequisites,
      readyForSubmission: evaluation.readyForSubmission,
      capabilities: agency.capabilities,
      hybrid: ['delivery', 'storage'].every(type => active.some(capability => capability.type === type)),
      activeZones: agency.activeZones,
      activeSites: agency.activeSites,
    };
  }
}
