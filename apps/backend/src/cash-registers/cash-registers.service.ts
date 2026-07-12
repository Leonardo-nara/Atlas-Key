import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CashMovementType,
  CashRegisterSessionStatus,
  Prisma,
  SalePaymentMethod
} from "@prisma/client";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { CashMovementDto } from "./dto/cash-movement.dto";
import { CloseCashRegisterSessionDto } from "./dto/close-cash-register-session.dto";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { ListCashRegisterSessionsQueryDto } from "./dto/list-cash-register-sessions-query.dto";
import { OpenCashRegisterDto } from "./dto/open-cash-register.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

const CASH_REGISTER_INCLUDE = {
  sessions: {
    where: { status: CashRegisterSessionStatus.OPEN },
    orderBy: { openedAt: "desc" },
    take: 1,
    include: {
      openedBy: { select: { id: true, name: true, email: true } }
    }
  }
} satisfies Prisma.CashRegisterInclude;

const SESSION_INCLUDE = {
  cashRegister: true,
  openedBy: { select: { id: true, name: true, email: true } },
  closedBy: { select: { id: true, name: true, email: true } },
  movements: {
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  },
  sales: {
    orderBy: { createdAt: "desc" },
    include: {
      payments: true,
      items: true,
      operator: { select: { id: true, name: true, email: true } }
    }
  }
} satisfies Prisma.CashRegisterSessionInclude;

type CashRegisterWithSession = Prisma.CashRegisterGetPayload<{
  include: typeof CASH_REGISTER_INCLUDE;
}>;
type CashSessionWithRelations = Prisma.CashRegisterSessionGetPayload<{
  include: typeof SESSION_INCLUDE;
}>;

@Injectable()
export class CashRegistersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService
  ) {}

  async create(ownerUserId: string, role: UserRole, dto: CreateCashRegisterDto) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);

    try {
      const register = await this.prisma.cashRegister.create({
        data: {
          storeId: store.id,
          name: dto.name
        },
        include: CASH_REGISTER_INCLUDE
      });

      return this.serializeCashRegister(register);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Ja existe um caixa com este nome nesta loja");
      }

      throw error;
    }
  }

  async list(ownerUserId: string, role: UserRole) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const registers = await this.prisma.cashRegister.findMany({
      where: { storeId: store.id },
      include: CASH_REGISTER_INCLUDE,
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });

    return registers.map((register) => this.serializeCashRegister(register));
  }

  async update(
    ownerUserId: string,
    role: UserRole,
    cashRegisterId: string,
    dto: UpdateCashRegisterDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    await this.ensureRegisterBelongsToStore(cashRegisterId, store.id);

    if (dto.active === false) {
      const openSession = await this.prisma.cashRegisterSession.findFirst({
        where: { cashRegisterId, status: CashRegisterSessionStatus.OPEN },
        select: { id: true }
      });

      if (openSession) {
        throw new ConflictException("Nao e possivel desativar um caixa com sessao aberta");
      }
    }

    try {
      const register = await this.prisma.cashRegister.update({
        where: { id: cashRegisterId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {})
        },
        include: CASH_REGISTER_INCLUDE
      });

      return this.serializeCashRegister(register);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Ja existe um caixa com este nome nesta loja");
      }

      throw error;
    }
  }

  async open(
    ownerUserId: string,
    role: UserRole,
    cashRegisterId: string,
    dto: OpenCashRegisterDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const openingAmount = new Prisma.Decimal(dto.openingAmount);

    const session = await this.prisma.$transaction(async (prisma) => {
      const register = await prisma.cashRegister.findFirst({
        where: { id: cashRegisterId, storeId: store.id }
      });

      if (!register) {
        throw new NotFoundException("Caixa nao encontrado para esta loja");
      }

      if (!register.active) {
        throw new ConflictException("Caixa inativo nao pode ser aberto");
      }

      const openSession = await prisma.cashRegisterSession.findFirst({
        where: { cashRegisterId, status: CashRegisterSessionStatus.OPEN },
        select: { id: true }
      });

      if (openSession) {
        throw new ConflictException("Este caixa ja possui uma sessao aberta");
      }

      const created = await prisma.cashRegisterSession.create({
        data: {
          cashRegisterId,
          storeId: store.id,
          openedByUserId: ownerUserId,
          openingAmount,
          expectedCashAmount: openingAmount,
          openingNotes: dto.notes,
          movements: {
            create: {
              storeId: store.id,
              userId: ownerUserId,
              type: CashMovementType.OPENING,
              amount: openingAmount,
              reason: dto.notes ?? "Abertura de caixa"
            }
          }
        },
        include: SESSION_INCLUDE
      });

      return created;
    });

    return this.serializeSession(session);
  }

  async getCurrentSession(ownerUserId: string, role: UserRole, cashRegisterId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    await this.ensureRegisterBelongsToStore(cashRegisterId, store.id);
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: {
        cashRegisterId,
        storeId: store.id,
        status: CashRegisterSessionStatus.OPEN
      },
      include: SESSION_INCLUDE,
      orderBy: { openedAt: "desc" }
    });

    return session ? this.serializeSession(session) : null;
  }

  async cashIn(ownerUserId: string, role: UserRole, sessionId: string, dto: CashMovementDto) {
    return this.recordManualMovement(
      ownerUserId,
      role,
      sessionId,
      CashMovementType.CASH_IN,
      dto
    );
  }

  async cashOut(ownerUserId: string, role: UserRole, sessionId: string, dto: CashMovementDto) {
    return this.recordManualMovement(
      ownerUserId,
      role,
      sessionId,
      CashMovementType.CASH_OUT,
      dto
    );
  }

  async findSession(ownerUserId: string, role: UserRole, sessionId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const session = await this.findOwnedSession(sessionId, store.id);

    return this.serializeSession(session);
  }

  async listSessions(
    ownerUserId: string,
    role: UserRole,
    query: ListCashRegisterSessionsQueryDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.CashRegisterSessionWhereInput = {
      storeId: store.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.cashRegisterId ? { cashRegisterId: query.cashRegisterId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            openedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.cashRegisterSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.cashRegisterSession.count({ where })
    ]);

    return {
      items: items.map((session) => this.serializeSession(session)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async close(
    ownerUserId: string,
    role: UserRole,
    sessionId: string,
    dto: CloseCashRegisterSessionDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const countedCashAmount = new Prisma.Decimal(dto.countedCashAmount);

    const session = await this.prisma.$transaction(async (prisma) => {
      const current = await prisma.cashRegisterSession.findFirst({
        where: { id: sessionId, storeId: store.id },
        include: { movements: true }
      });

      if (!current) {
        throw new NotFoundException("Sessao de caixa nao encontrada para esta loja");
      }

      if (current.status !== CashRegisterSessionStatus.OPEN) {
        throw new ConflictException("Sessao de caixa ja esta fechada");
      }

      const expectedCashAmount = calculateExpectedCash(current.movements);
      const differenceAmount = countedCashAmount.sub(expectedCashAmount);

      await prisma.cashRegisterSession.update({
        where: { id: sessionId },
        data: {
          status: CashRegisterSessionStatus.CLOSED,
          closedByUserId: ownerUserId,
          expectedCashAmount,
          countedCashAmount,
          differenceAmount,
          closingNotes: dto.notes,
          closedAt: new Date()
        }
      });

      if (!differenceAmount.equals(0)) {
        await prisma.cashMovement.create({
          data: {
            cashRegisterSessionId: sessionId,
            storeId: store.id,
            userId: ownerUserId,
            type: CashMovementType.CLOSING_DIFFERENCE,
            amount: differenceAmount,
            reason: "Diferenca apurada no fechamento"
          }
        });
      }

      return this.findOwnedSessionInTransaction(prisma, sessionId, store.id);
    });

    return this.serializeSession(session);
  }

  async report(ownerUserId: string, role: UserRole, sessionId: string) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const session = await this.findOwnedSession(sessionId, store.id);
    const summary = this.buildSessionSummary(session);

    return {
      session: this.serializeSession(session),
      report: {
        cashRegister: session.cashRegister,
        openedBy: session.openedBy,
        closedBy: session.closedBy,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        ...summary,
        movements: session.movements.map((movement) => this.serializeMovement(movement))
      }
    };
  }

  private async recordManualMovement(
    ownerUserId: string,
    role: UserRole,
    sessionId: string,
    type: CashMovementType,
    dto: CashMovementDto
  ) {
    const store = await this.storesService.getStoreByOwner(ownerUserId, role);
    const amount = new Prisma.Decimal(dto.amount);

    const session = await this.prisma.$transaction(async (prisma) => {
      const current = await prisma.cashRegisterSession.findFirst({
        where: { id: sessionId, storeId: store.id },
        include: { movements: true }
      });

      if (!current) {
        throw new NotFoundException("Sessao de caixa nao encontrada para esta loja");
      }

      if (current.status !== CashRegisterSessionStatus.OPEN) {
        throw new ConflictException("Sessao de caixa fechada nao aceita movimentos");
      }

      const expectedCashAmount = calculateExpectedCash(current.movements);

      if (type === CashMovementType.CASH_OUT && amount.greaterThan(expectedCashAmount)) {
        throw new BadRequestException("Sangria nao pode ser maior que o saldo esperado em dinheiro");
      }

      await prisma.cashMovement.create({
        data: {
          cashRegisterSessionId: sessionId,
          storeId: store.id,
          userId: ownerUserId,
          type,
          amount,
          reason: dto.reason
        }
      });

      const nextExpected = type === CashMovementType.CASH_IN
        ? expectedCashAmount.add(amount)
        : expectedCashAmount.sub(amount);

      await prisma.cashRegisterSession.update({
        where: { id: sessionId },
        data: { expectedCashAmount: nextExpected }
      });

      return this.findOwnedSessionInTransaction(prisma, sessionId, store.id);
    });

    return this.serializeSession(session);
  }

  private async ensureRegisterBelongsToStore(cashRegisterId: string, storeId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id: cashRegisterId, storeId },
      select: { id: true }
    });

    if (!register) {
      throw new NotFoundException("Caixa nao encontrado para esta loja");
    }
  }

  private async findOwnedSession(sessionId: string, storeId: string) {
    return this.findOwnedSessionInTransaction(this.prisma, sessionId, storeId);
  }

  private async findOwnedSessionInTransaction(
    prisma: Pick<PrismaService, "cashRegisterSession">,
    sessionId: string,
    storeId: string
  ) {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, storeId },
      include: SESSION_INCLUDE
    });

    if (!session) {
      throw new NotFoundException("Sessao de caixa nao encontrada para esta loja");
    }

    return session;
  }

  private serializeCashRegister(register: CashRegisterWithSession) {
    const currentSession = register.sessions[0] ?? null;

    return {
      id: register.id,
      storeId: register.storeId,
      name: register.name,
      active: register.active,
      createdAt: register.createdAt,
      updatedAt: register.updatedAt,
      currentSession: currentSession
        ? {
            id: currentSession.id,
            status: currentSession.status,
            openingAmount: Number(currentSession.openingAmount),
            expectedCashAmount: Number(currentSession.expectedCashAmount),
            openedAt: currentSession.openedAt,
            openedBy: currentSession.openedBy
          }
        : null
    };
  }

  private serializeSession(session: CashSessionWithRelations) {
    const summary = this.buildSessionSummary(session);

    return {
      id: session.id,
      cashRegisterId: session.cashRegisterId,
      storeId: session.storeId,
      status: session.status,
      openingAmount: Number(session.openingAmount),
      expectedCashAmount: Number(session.expectedCashAmount),
      countedCashAmount: session.countedCashAmount === null ? null : Number(session.countedCashAmount),
      differenceAmount: session.differenceAmount === null ? null : Number(session.differenceAmount),
      openingNotes: session.openingNotes,
      closingNotes: session.closingNotes,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cashRegister: session.cashRegister,
      openedBy: session.openedBy,
      closedBy: session.closedBy,
      summary,
      movements: session.movements.map((movement) => this.serializeMovement(movement)),
      sales: session.sales.map((sale) => ({
        id: sale.id,
        customerName: sale.customerName,
        status: sale.status,
        total: Number(sale.total),
        completedAt: sale.completedAt,
        payments: sale.payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount)
        })),
        itemsCount: sale.items.length,
        operator: sale.operator
      }))
    };
  }

  private serializeMovement(movement: CashSessionWithRelations["movements"][number]) {
    return {
      id: movement.id,
      cashRegisterSessionId: movement.cashRegisterSessionId,
      storeId: movement.storeId,
      userId: movement.userId,
      type: movement.type,
      amount: Number(movement.amount),
      reason: movement.reason,
      saleId: movement.saleId,
      createdAt: movement.createdAt,
      user: movement.user
    };
  }

  private buildSessionSummary(session: CashSessionWithRelations) {
    const salesByPaymentMethod = {
      [SalePaymentMethod.CASH]: new Prisma.Decimal(0),
      [SalePaymentMethod.CARD]: new Prisma.Decimal(0),
      [SalePaymentMethod.PIX_MANUAL]: new Prisma.Decimal(0),
      [SalePaymentMethod.PIX_AUTOMATIC]: new Prisma.Decimal(0)
    };
    let totalSold = new Prisma.Decimal(0);

    for (const sale of session.sales) {
      totalSold = totalSold.add(sale.total);

      for (const payment of sale.payments) {
        salesByPaymentMethod[payment.method] = salesByPaymentMethod[payment.method].add(payment.amount);
      }
    }

    const cashInTotal = sumMovements(session.movements, CashMovementType.CASH_IN);
    const cashOutTotal = sumMovements(session.movements, CashMovementType.CASH_OUT);
    const expectedCashAmount = calculateExpectedCash(session.movements);

    return {
      openingAmount: Number(session.openingAmount),
      cashSales: Number(salesByPaymentMethod.CASH),
      cardSales: Number(salesByPaymentMethod.CARD),
      pixManualSales: Number(salesByPaymentMethod.PIX_MANUAL),
      pixAutomaticSales: Number(salesByPaymentMethod.PIX_AUTOMATIC),
      totalSold: Number(totalSold),
      cashInTotal: Number(cashInTotal),
      cashOutTotal: Number(cashOutTotal),
      expectedCashAmount: Number(expectedCashAmount),
      countedCashAmount: session.countedCashAmount === null ? null : Number(session.countedCashAmount),
      differenceAmount: session.differenceAmount === null ? null : Number(session.differenceAmount)
    };
  }
}

function calculateExpectedCash(movements: Array<{ type: CashMovementType; amount: Prisma.Decimal }>) {
  return movements.reduce((sum, movement) => {
    if (
      movement.type === CashMovementType.OPENING ||
      movement.type === CashMovementType.CASH_IN ||
      movement.type === CashMovementType.SALE
    ) {
      return sum.add(movement.amount);
    }

    if (movement.type === CashMovementType.CASH_OUT || movement.type === CashMovementType.REFUND) {
      return sum.sub(movement.amount);
    }

    return sum;
  }, new Prisma.Decimal(0));
}

function sumMovements(
  movements: Array<{ type: CashMovementType; amount: Prisma.Decimal }>,
  type: CashMovementType
) {
  return movements
    .filter((movement) => movement.type === type)
    .reduce((sum, movement) => sum.add(movement.amount), new Prisma.Decimal(0));
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
