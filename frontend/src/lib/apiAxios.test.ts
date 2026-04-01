/**
 * Unit tests for the Axios API client.
 * Tests axios configuration, token injection, and 401 error handling.
 */
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  let mockAxiosInstance: any;
  let requestInterceptor: any;
  let responseErrorInterceptor: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
    delete (window as any).location;
    (window as any).location = { href: 'http://localhost/' };

    mockAxiosInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockAxiosInstance.interceptors.request.use.mockImplementation((fn: any) => {
      requestInterceptor = fn;
      return 0;
    });

    mockAxiosInstance.interceptors.response.use.mockImplementation(
      (_: any, errorFn: any) => {
        responseErrorInterceptor = errorFn;
        return 0;
      }
    );

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  it('should create axios instance with correct baseURL', () => {
    // Update require to point to the renamed file
    jest.isolateModules(() => require('./apiAxios'));

    expect(mockedAxios.create).toHaveBeenCalledWith({
      baseURL: 'http://localhost:3001',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should add Authorization header when token exists', () => {
    jest.isolateModules(() => require('./apiAxios'));
    (localStorage.getItem as jest.Mock).mockReturnValue('test-token');

    const config = { headers: {} };
    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  it('should not add Authorization header when no token', () => {
    jest.isolateModules(() => require('./apiAxios'));
    (localStorage.getItem as jest.Mock).mockReturnValue(null);

    const config = { headers: {} };
    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('should clear storage and redirect on 401 error', async () => {
    jest.isolateModules(() => require('./apiAxios'));
    const error = { response: { status: 401 } };

    await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

    expect(localStorage.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  });

  it('should not redirect on non-401 errors', async () => {
    jest.isolateModules(() => require('./apiAxios'));
    window.location.href = 'http://localhost/';
    const error = { response: { status: 500 } };

    await expect(responseErrorInterceptor(error)).rejects.toEqual(error);

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(window.location.href).toBe('http://localhost/');
  });
});