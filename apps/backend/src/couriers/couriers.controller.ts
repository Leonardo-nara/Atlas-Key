import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedUser } from "../common/authenticated-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../common/enums/user-role.enum";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { IMAGE_MAX_FILE_SIZE_BYTES } from "../common/storage/image-storage.service";
import type {
  StreamResponse,
  UploadedFile as UploadedStorageFile
} from "../common/storage/uploaded-file.interface";
import { CouriersService } from "./couriers.service";
import { UpdateCourierProfileDto } from "./dto/update-courier-profile.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COURIER)
@Controller("couriers")
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Get("me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.couriersService.getMe(user.sub);
  }

  @Patch("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierProfileDto
  ) {
    return this.couriersService.updateMe(user.sub, dto);
  }

  @Patch("me/profile-image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: IMAGE_MAX_FILE_SIZE_BYTES
      }
    })
  )
  uploadProfileImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedStorageFile
  ) {
    return this.couriersService.uploadProfileImage(user.sub, file);
  }

  @Delete("me/profile-image")
  removeProfileImage(@CurrentUser() user: AuthenticatedUser) {
    return this.couriersService.removeProfileImage(user.sub);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("media/couriers")
export class CourierMediaController {
  constructor(private readonly couriersService: CouriersService) {}

  @Get(":courierId/profile-image")
  async getProfileImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("courierId") courierId: string,
    @Res() response: StreamResponse & NodeJS.WritableStream
  ) {
    const file = await this.couriersService.getProfileImage(
      user.sub,
      user.role,
      courierId
    );

    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Length", file.size.toString());
    response.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`
    );

    file.stream.pipe(response);
  }
}
