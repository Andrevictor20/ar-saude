import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location } from '../entities/location.entity';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  async getAllLocations(): Promise<Location[]> {
    return this.locationsService.getAllLocations();
  }
}
