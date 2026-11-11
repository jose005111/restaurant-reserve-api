import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty({ message: 'A password é obrigatória' })
  @MinLength(1, { message: 'A password é obrigatória' })
  password: string;
}
