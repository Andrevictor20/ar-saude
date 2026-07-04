import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location } from '../entities/location.entity';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as localidades monitoradas no Brasil' })
  async getAllLocations(): Promise<Location[]> {
    return this.locationsService.getAllLocations();
  }
}
