import { OptionalField } from '../../../common/decorators/optional-field.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateDiningTableDto {
  @ApiPropertyOptional()
  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  label?: string;

  @ApiPropertyOptional()
  @OptionalField()
  @IsBoolean()
  isActive?: boolean;
}
