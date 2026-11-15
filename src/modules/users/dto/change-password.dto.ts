import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1, writeOnly: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
