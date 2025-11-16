import { sdk } from '../sdk';
import type { MarketrixConfig, TourData } from '../types';
import { extractApiData, extractErrorMessage } from '../utils/apiUtils';
import { isErrorResponseBody, isTourDataArray } from '../utils/typeGuards';

export class TourService {
  private config: MarketrixConfig;

  constructor(config: MarketrixConfig) {
    this.config = config;
  }

  /**
   * Fetch and log all tour data related to connection_id
   */
  async logAllTourDataByConnectionId(connectionId: number): Promise<void> {
    try {
      console.log('=== FETCHING ALL TOUR DATA BY CONNECTION ID ===');
      console.log('Connection ID:', connectionId);
      console.log('Marketrix ID:', this.config.marketrixId);
      console.log('Marketrix Key:', this.config.marketrixKey);

      const response = await sdk.tourSearch({
        query: {
          connection_id: connectionId,
        },
      });

      console.log('Tour API Response Status:', response.status);

      const toursData = extractApiData(response);
      if (toursData && isTourDataArray(toursData)) {
        const tours = toursData;
        console.log('=== ALL TOUR DATA FOUND ===');
        console.log('Total tours found for connection_id', connectionId, ':', tours.length);

        if (tours.length === 0) {
          console.log('No tours found for this connection_id');
          return;
        }

        tours.forEach((tour, index) => {
          console.log(`\n=== TOUR ${index + 1} ===`);
          console.log('Tour ID:', tour.id);
          console.log('Connection ID:', tour.connection_id);
          console.log('Question:', tour.question);
          console.log('Created At:', tour.created_at);
          console.log('Updated At:', tour.updated_at);
          console.log('Answer Steps Count:', tour.answer.length);

          if (tour.answer.length > 0) {
            console.log('\n--- TOUR STEPS ---');
            tour.answer.forEach((step, stepIndex: number) => {
              console.log(`  Step ${stepIndex + 1}:`);
              console.log('    Step Number:', step.step_number);
              console.log('    Step Description:', step.description);
              console.log('    Step Selector:', step.selector || 'N/A');
              console.log('    Step Action:', step.action || 'N/A');
              console.log('    Step Element:', step.element || 'N/A');
              console.log('    Step Text:', step.text || 'N/A');
            });
          } else {
            console.log('No steps found for this tour');
          }
        });

        // Summary
        console.log('\n=== TOUR DATA SUMMARY ===');
        console.log('Connection ID:', connectionId);
        console.log('Total Tours:', tours.length);
        console.log(
          'Total Steps Across All Tours:',
          tours.reduce((total, tour) => total + tour.answer.length, 0)
        );

        // Group by target
        const targetGroups: Record<string, TourData[]> = {};
        tours.forEach((tour) => {
          const target = 'No Target'; // TourData doesn't have target property
          if (!targetGroups[target]) {
            targetGroups[target] = [];
          }
          targetGroups[target].push(tour);
        });

        console.log('\n--- TOURS BY TARGET ---');
        Object.entries(targetGroups).forEach(([target, tours]) => {
          console.log(`${target}: ${tours.length} tour(s)`);
        });
      } else {
        const body = response.body;
        if (isErrorResponseBody(body)) {
          console.warn(
            'No tour data found or API error:',
            body.error || body.message || 'Unknown error'
          );
        } else {
          console.warn('No tour data found or API error: Unknown error');
        }
      }
    } catch (error) {
      console.error('Failed to fetch tour data by connection ID:', extractErrorMessage(error));
    }
  }

  /**
   * Search and log all tours without connection_id filter
   */
  async logAllTourData(): Promise<void> {
    try {
      console.log('=== FETCHING ALL TOUR DATA ===');
      console.log('Marketrix ID:', this.config.marketrixId);
      console.log('Marketrix Key:', this.config.marketrixKey);

      const response = await sdk.tourSearch({
        query: {},
      });

      console.log('Tour API Response Status:', response.status);

      const toursData = extractApiData(response);
      if (toursData && isTourDataArray(toursData)) {
        const tours = toursData;
        console.log('=== ALL TOUR DATA FOUND ===');
        console.log('Total tours found:', tours.length);

        if (tours.length === 0) {
          console.log('No tours found');
          return;
        }

        // Group by connection_id
        const connectionGroups: Record<number, TourData[]> = {};
        tours.forEach((tour) => {
          const connectionId = tour.connection_id;
          if (!connectionGroups[connectionId]) {
            connectionGroups[connectionId] = [];
          }
          connectionGroups[connectionId].push(tour);
        });

        console.log('\n=== TOURS BY CONNECTION ID ===');
        Object.entries(connectionGroups).forEach(([connectionId, tours]) => {
          console.log(`\nConnection ID ${connectionId}: ${tours.length} tour(s)`);
          tours.forEach((tour, index) => {
            console.log(`  Tour ${index + 1}:`);
            console.log('    Tour ID:', tour.id);
            console.log('    Question:', tour.question);
            console.log('    Steps Count:', tour.answer.length);
          });
        });

        // Summary
        console.log('\n=== OVERALL SUMMARY ===');
        console.log('Total Tours:', tours.length);
        console.log('Unique Connection IDs:', Object.keys(connectionGroups).length);
        console.log(
          'Total Steps Across All Tours:',
          tours.reduce((total, tour) => total + tour.answer.length, 0)
        );
      } else {
        const body = response.body;
        if (isErrorResponseBody(body)) {
          console.warn(
            'No tour data found or API error:',
            body.error || body.message || 'Unknown error'
          );
        } else {
          console.warn('No tour data found or API error: Unknown error');
        }
      }
    } catch (error) {
      console.error('Failed to fetch all tour data:', extractErrorMessage(error));
    }
  }
}

export default TourService;
