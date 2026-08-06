import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type UserRole = 'admin' | 'technician' | 'customer';
export type AuthSource = 'local' | 'ldap';

export interface UserAttributes {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  passwordHash: string | null;
  authSource: AuthSource;
  externalId: string | null;
  isActive: boolean;
  /** Seniority among staff for the "can't manage someone above you" rule - higher outranks lower. */
  rank: number;
  /** The one (or few) accounts that bypass rank/permission checks entirely. Only a super admin can create another. */
  isSuperAdmin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'passwordHash' | 'authSource' | 'externalId' | 'isActive' | 'rank' | 'isSuperAdmin' | 'createdAt' | 'updatedAt'
>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare email: string;
  declare displayName: string;
  declare role: UserRole;
  declare passwordHash: string | null;
  declare authSource: AuthSource;
  declare externalId: string | null;
  declare isActive: boolean;
  declare rank: number;
  declare isSuperAdmin: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'technician', 'customer'),
      allowNull: false,
      defaultValue: 'customer',
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    authSource: {
      type: DataTypes.ENUM('local', 'ldap'),
      allowNull: false,
      defaultValue: 'local',
    },
    externalId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isSuperAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
  }
);

// Safe to embed in any API response - excludes passwordHash and externalId (LDAP DN).
// Use this on every `include: [{ model: User, ... }]` whose result reaches res.json();
// Sequelize returns every column by default, and it's easy to forget this on a new one.
export const PUBLIC_USER_ATTRIBUTES = ['id', 'email', 'displayName', 'role', 'isActive', 'rank', 'isSuperAdmin'] as const;
