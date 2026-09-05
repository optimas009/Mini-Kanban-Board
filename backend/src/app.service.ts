import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      message: 'Mini Kanban API',
      status: 'ok',
    };
  }
}
