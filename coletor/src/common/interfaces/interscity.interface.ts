/** Payload para registro de uma Capability no InterSCity. */
export interface InterscityCapabilityPayload {
  name: string;
  description: string;
  capability_type: 'sensor' | 'actuator';
}

/** Payload para registro de um Resource (bairro) no InterSCity. */
export interface InterscityResourcePayload {
  data: {
    description: string;
    capabilities: string[];
    status: 'active' | 'inactive';
    lat: number;
    lon: number;
  };
}

/** Payload de envio de medição ao InterSCity. */
export interface InterscityMeasurementPayload {
  data: {
    [capabilityName: string]: Array<{
      value: number | string | null;
      timestamp: string;
    }>;
  };
}

/** Resposta do InterSCity ao registrar/consultar um recurso. */
export interface InterscityResourceResponse {
  data: {
    uuid: string;
    description: string;
    capabilities: string[];
    status: string;
    lat: number;
    lon: number;
    [key: string]: unknown;
  };
}
