import { API_URL_GLOBAL_SET } from '../config';
import type { MarketrixConfig } from '../types';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  selector?: string;
  xpath?: string;
  action?: string;
  order: number;
}

export interface TourAnswer {
  steps: TourStep[];
}

export interface TourData {
  id: number;
  connection_id: number;
  question: string;
  answer: TourAnswer;
  target: string;
  created_at: string;
  updated_at: string;
}

export class TourService {
  private config: MarketrixConfig;
  private apiBaseUrl: string;

  constructor(config: MarketrixConfig) {
    this.config = config;
    this.apiBaseUrl = API_URL_GLOBAL_SET.API_END_POINT;
  }

  /**
   * Fetch and log all tour data related to connection_id
   */
  async logAllTourDataByConnectionId(connectionId: number): Promise<void> {
    try {
      console.log('=== FETCHING ALL TOUR DATA BY CONNECTION ID ===');
      console.log('Connection ID:', connectionId);
      console.log('API Base URL:', this.apiBaseUrl);
      console.log('Marketrix ID:', this.config.marketrixId);
      console.log('Marketrix Key:', this.config.marketrixKey);

      // Try query parameters first (for public access)
      let url = `${this.apiBaseUrl}/tour?connection_id=${connectionId}&tenant_id=2`;
      console.log('Full URL with params:', url);

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If that fails, try with Authorization header
      if (!response.ok) {
        console.log('Query parameters failed, trying Authorization header...');
        url = `${this.apiBaseUrl}/tour?connection_id=${connectionId}`;
        console.log('Full URL:', url);
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.marketrixKey}`,
          },
        });
      }

      // If that fails, try with X-Marketrix headers
      if (!response.ok) {
        console.log('Authorization header failed, trying X-Marketrix headers...');
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Marketrix-ID': this.config.marketrixId,
            'X-Marketrix-Key': this.config.marketrixKey,
          },
        });
      }

      console.log('Tour API Response Status:', response.status);
      console.log('Tour API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('Tour API Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error Response Body:', errorText);
        return;
      }

      const data = await response.json();
      console.log('Tour API Response Data:', data);

      if (data.success && data.data) {
        const tours = data.data as TourData[];
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
          console.log('Target:', tour.target);
          console.log('Created At:', tour.created_at);
          console.log('Updated At:', tour.updated_at);
          console.log('Answer Steps Count:', tour.answer.steps.length);

          if (tour.answer.steps.length > 0) {
            console.log('\n--- TOUR STEPS ---');
            tour.answer.steps.forEach((step, stepIndex) => {
              console.log(`  Step ${stepIndex + 1}:`);
              console.log('    Step ID:', step.id);
              console.log('    Step Title:', step.title);
              console.log('    Step Description:', step.description);
              console.log('    Step Selector:', step.selector || 'N/A');
              console.log('    Step XPath:', step.xpath || 'N/A');
              console.log('    Step Action:', step.action || 'N/A');
              console.log('    Step Order:', step.order);
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
          tours.reduce((total, tour) => total + tour.answer.steps.length, 0)
        );

        // Group by target
        const targetGroups = tours.reduce(
          (groups, tour) => {
            const target = tour.target || 'No Target';
            if (!groups[target]) {
              groups[target] = [];
            }
            groups[target].push(tour);
            return groups;
          },
          {} as Record<string, TourData[]>
        );

        console.log('\n--- TOURS BY TARGET ---');
        Object.entries(targetGroups).forEach(([target, tours]) => {
          console.log(`${target}: ${tours.length} tour(s)`);
        });
      } else {
        console.warn('No tour data found or API error:', data.error || data.message);
      }
    } catch (error) {
      console.error('Failed to fetch tour data by connection ID:', error);
    }
  }

  /**
   * Search and log all tours without connection_id filter
   */
  async logAllTourData(): Promise<void> {
    try {
      console.log('=== FETCHING ALL TOUR DATA ===');
      console.log('API Base URL:', this.apiBaseUrl);
      console.log('Marketrix ID:', this.config.marketrixId);
      console.log('Marketrix Key:', this.config.marketrixKey);

      // Try query parameters first (for public access)
      let url = `${this.apiBaseUrl}/tour?tenant_id=2`;
      console.log('Full URL with params:', url);

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // If that fails, try with Authorization header
      if (!response.ok) {
        console.log('Query parameters failed, trying Authorization header...');
        url = `${this.apiBaseUrl}/tour`;
        console.log('Full URL:', url);
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.marketrixKey}`,
          },
        });
      }

      // If that fails, try with X-Marketrix headers
      if (!response.ok) {
        console.log('Authorization header failed, trying X-Marketrix headers...');
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Marketrix-ID': this.config.marketrixId,
            'X-Marketrix-Key': this.config.marketrixKey,
          },
        });
      }

      console.log('Tour API Response Status:', response.status);
      console.log('Tour API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('Tour API Error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error Response Body:', errorText);
        return;
      }

      const data = await response.json();
      console.log('Tour API Response Data:', data);

      if (data.success && data.data) {
        const tours = data.data as TourData[];
        console.log('=== ALL TOUR DATA FOUND ===');
        console.log('Total tours found:', tours.length);

        if (tours.length === 0) {
          console.log('No tours found');
          return;
        }

        // Group by connection_id
        const connectionGroups = tours.reduce(
          (groups, tour) => {
            const connectionId = tour.connection_id;
            if (!groups[connectionId]) {
              groups[connectionId] = [];
            }
            groups[connectionId].push(tour);
            return groups;
          },
          {} as Record<number, TourData[]>
        );

        console.log('\n=== TOURS BY CONNECTION ID ===');
        Object.entries(connectionGroups).forEach(([connectionId, tours]) => {
          console.log(`\nConnection ID ${connectionId}: ${tours.length} tour(s)`);
          tours.forEach((tour, index) => {
            console.log(`  Tour ${index + 1}:`);
            console.log('    Tour ID:', tour.id);
            console.log('    Question:', tour.question);
            console.log('    Target:', tour.target);
            console.log('    Steps Count:', tour.answer.steps.length);
          });
        });

        // Summary
        console.log('\n=== OVERALL SUMMARY ===');
        console.log('Total Tours:', tours.length);
        console.log('Unique Connection IDs:', Object.keys(connectionGroups).length);
        console.log(
          'Total Steps Across All Tours:',
          tours.reduce((total, tour) => total + tour.answer.steps.length, 0)
        );
      } else {
        console.warn('No tour data found or API error:', data.error || data.message);
      }
    } catch (error) {
      console.error('Failed to fetch all tour data:', error);
    }
  }
}

export default TourService;
