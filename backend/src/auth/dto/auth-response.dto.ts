export class AuthResponseDto {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    assignedClinics: string[];
  };
  accessToken: string;
}