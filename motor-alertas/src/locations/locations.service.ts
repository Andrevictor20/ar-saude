import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Location } from '../entities/location.entity';

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  async onModuleInit() {
    await this.seedLocationsIfEmpty();
  }

  async seedLocationsIfEmpty() {
    const count = await this.locationRepository.count();
    if (count > 0) {
      this.logger.log(`Locations DB already populated with ${count} records.`);
      return;
    }

    this.logger.log('Locations DB is empty. Fetching from IBGE...');
    try {
      // 1. Fetch all municipalities
      const ibgeResponse = await axios.get('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
      const municipalities = ibgeResponse.data;

      // Note: IBGE API /localidades/municipios doesn't return lat/long directly.
      // We would need to cross-reference with another dataset or use a simplified dataset.
      // Since we need lat/long, we'll fetch from a known gist or construct a fallback.
      // For this implementation, we will use a public dataset from IBGE that contains lat/long, 
      // or we can generate them. 
      // Actually, IBGE doesn't have a single API for both. There's a github repo often used:
      const geoResponse = await axios.get('https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/json/municipios.json');
      const geoData = geoResponse.data;

      const locations: Partial<Location>[] = geoData.map((city: any) => ({
        name: city.nome,
        state: city.codigo_uf.toString(), // or we can map to state name
        latitude: city.latitude,
        longitude: city.longitude,
        ibgeCode: city.codigo_ibge.toString(),
      }));

      // Insert in batches of 1000
      const batchSize = 1000;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        await this.locationRepository.insert(batch);
        this.logger.log(`Inserted batch ${i} to ${i + batch.length}`);
      }
      
      this.logger.log(`Successfully seeded ${locations.length} municipalities.`);
    } catch (error) {
      this.logger.error('Failed to seed locations', error instanceof Error ? error.stack : String(error));
    }
  }

  async getAllLocations(): Promise<Location[]> {
    return this.locationRepository.find();
  }
}
