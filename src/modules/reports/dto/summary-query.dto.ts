import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';
import { OptionalField } from '../../../common/decorators/optional-field.decorator';

export class SummaryQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    description:
      'Primeiro dia do período em Africa/Luanda. Por defeito, seis dias antes de to.',
  })
  @OptionalField()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from deve usar YYYY-MM-DD' })
  @IsDateString({}, { message: 'from deve ser uma data válida' })
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Último dia do período em Africa/Luanda. Por defeito, hoje.',
  })
  @OptionalField()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to deve usar YYYY-MM-DD' })
  @IsDateString({}, { message: 'to deve ser uma data válida' })
  to?: string;
}
