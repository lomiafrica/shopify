import {CustomFetchApi} from '@shopify/graphql-client';

import {AdminApiClientOptions} from '../types';

export enum Method {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE',
}

type SearchParamField = string | number;
export type SearchParamFields =
  | SearchParamField
  | SearchParamField[]
  | Record<string, SearchParamField | SearchParamField[]>;
export type SearchParams = Record<string, SearchParamFields>;

export type HeaderOptions = Record<string, string | number | string[]>;

export interface GetRequestOptions {
  headers?: HeaderOptions;
  data?: Record<string, any> | string;
  searchParams?: SearchParams;
  retries?: number;
  apiVersion?: string;
}

export interface PostRequestOptions extends GetRequestOptions {
  data: Required<GetRequestOptions>['data'];
}

export type PutRequestOptions = PostRequestOptions

export type DeleteRequestOptions = GetRequestOptions

export interface AdminRestApiClientOptions extends AdminApiClientOptions {
  scheme?: 'https' | 'http';
  defaultRetryTime?: number;
  formatPaths?: boolean;
}

export type RequestOptions = (GetRequestOptions | PostRequestOptions) & {
  method: Method;
};

export interface AdminRestApiClient {
  get: (
    path: string,
    options?: GetRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  put: (
    path: string,
    options?: PutRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  post: (
    path: string,
    options?: PostRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  delete: (
    path: string,
    options?: DeleteRequestOptions,
  ) => ReturnType<CustomFetchApi>;
}
