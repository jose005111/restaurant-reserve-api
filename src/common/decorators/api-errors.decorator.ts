import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';

export const ApiErrors = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) => ApiResponse({ status, type: ApiErrorDto })),
  );
