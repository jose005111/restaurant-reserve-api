import { UserRole } from '../../../common/enums/user-role.enum';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
}
