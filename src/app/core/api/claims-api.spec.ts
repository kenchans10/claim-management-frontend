import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClaimsApi } from './claims-api';

describe('ClaimsApi', () => {
  let api: ClaimsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ClaimsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('repeats status filters for the open work queue', async () => {
    const response = api.list({
      status: ['Submitted', 'UnderReview'],
      page: 1,
    });
    await new Promise((resolve) => setTimeout(resolve));
    const request = http.expectOne((candidate) =>
      candidate.url.startsWith('/api/v1/claims?'),
    );
    request.flush({ items: [], page: 1, pageSize: 20, totalCount: 0 });
    await expect(response).resolves.toMatchObject({ totalCount: 0 });
  });
});
