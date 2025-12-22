import * as http from 'http';

const HEALTH_SUFFIXES = ['/api/v1/health/adb', '/api/health/adb', '/health'];

export const buildHealthUrls = (host: string, port: number): string[] =>
  HEALTH_SUFFIXES.map((suffix) => `http://${host}:${port}${suffix}`);

type HttpGet = (url: string, callback: (res: http.IncomingMessage) => void) => http.ClientRequest;

export const checkBackendAlreadyRunning = (
  host: string,
  port: number,
  httpGet: HttpGet = http.get
): Promise<boolean> => {
  const healthEndpoints = buildHealthUrls(host, port);

  return new Promise((resolve) => {
    const tryEndpoint = (index: number) => {
      if (index >= healthEndpoints.length) {
        resolve(false);
        return;
      }
      const url = healthEndpoints[index];
      const req = httpGet(url, (res) => {
        res.resume();
        const status = res.statusCode ?? 500;
        if (status === 404) {
          tryEndpoint(index + 1);
        } else {
          resolve(true);
        }
      });
      req.on('error', () => tryEndpoint(index + 1));
      req.setTimeout(1500, () => {
        req.destroy();
        tryEndpoint(index + 1);
      });
    };
    tryEndpoint(0);
  });
};
