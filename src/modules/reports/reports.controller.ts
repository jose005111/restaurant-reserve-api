import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrors } from '../../common/decorators/api-errors.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { SummaryResponseDto } from './dto/summary-response.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@ApiErrors(400, 401, 403, 404, 500)
@Roles(UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.COUNTER)
  @ApiOkResponse({ type: DashboardResponseDto })
  dashboard(
    @CurrentUser() user: AuthUser,
    @Query() query: SummaryQueryDto,
  ): Promise<DashboardResponseDto> {
    return this.reports.dashboard(user, query);
  }

  @Get('summary')
  @ApiOkResponse({ type: SummaryResponseDto })
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: SummaryQueryDto,
  ): Promise<SummaryResponseDto> {
    return this.reports.summary(user, query);
  }
}
