// server/models/BaseModel.js
// Modelo base para interacciones con Supabase

export class BaseModel {
  constructor(supabase, tableName) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  /**
   * Obtener todos los registros con filtros opcionales
   */
  async findAll(filters = {}, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select(options.select || '*', { 
          count: options.count ? 'exact' : undefined 
        });

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // Aplicar ordenamiento
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Aplicar paginación
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const result = await query;
      
      if (result.error) {
        throw this.handleSupabaseError(result.error);
      }

      return {
        data: result.data || [],
        count: result.count
      };
    } catch (error) {
      console.error(`Error in ${this.tableName}.findAll:`, error);
      throw error;
    }
  }

  /**
   * Obtener un registro por ID
   */
  async findById(id, options = {}) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(options.select || '*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado
        }
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error(`Error in ${this.tableName}.findById:`, error);
      throw error;
    }
  }

  /**
   * Obtener un registro por filtros
   */
  async findOne(filters = {}, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select(options.select || '*');

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado
        }
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error(`Error in ${this.tableName}.findOne:`, error);
      throw error;
    }
  }

  /**
   * Crear un nuevo registro
   */
  async create(data, options = {}) {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select(options.select || '*')
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return result;
    } catch (error) {
      console.error(`Error in ${this.tableName}.create:`, error);
      throw error;
    }
  }

  /**
   * Crear múltiples registros
   */
  async createMany(dataArray, options = {}) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert(dataArray)
        .select(options.select || '*');

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data || [];
    } catch (error) {
      console.error(`Error in ${this.tableName}.createMany:`, error);
      throw error;
    }
  }

  /**
   * Actualizar un registro por ID
   */
  async updateById(id, data, options = {}) {
    try {
      // Agregar timestamp de actualización
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select(options.select || '*')
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return result;
    } catch (error) {
      console.error(`Error in ${this.tableName}.updateById:`, error);
      throw error;
    }
  }

  /**
   * Actualizar registros por filtros
   */
  async updateWhere(filters, data, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .update({
          ...data,
          updated_at: new Date().toISOString()
        });

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data: result, error } = await query.select(options.select || '*');

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return result || [];
    } catch (error) {
      console.error(`Error in ${this.tableName}.updateWhere:`, error);
      throw error;
    }
  }

  /**
   * Eliminar un registro por ID
   */
  async deleteById(id) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error(`Error in ${this.tableName}.deleteById:`, error);
      throw error;
    }
  }

  /**
   * Contar registros con filtros
   */
  async count(filters = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      // Aplicar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return count || 0;
    } catch (error) {
      console.error(`Error in ${this.tableName}.count:`, error);
      throw error;
    }
  }

  /**
   * Verificar si existe un registro
   */
  async exists(filters) {
    try {
      const count = await this.count(filters);
      return count > 0;
    } catch (error) {
      console.error(`Error in ${this.tableName}.exists:`, error);
      throw error;
    }
  }

  /**
   * Ejecutar función RPC de Supabase
   */
  async callFunction(functionName, params = {}) {
    try {
      const { data, error } = await this.supabase
        .rpc(functionName, params);

      if (error) {
        throw this.handleSupabaseError(error);
      }

      return data;
    } catch (error) {
      console.error(`Error calling function ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * Manejar errores de Supabase
   */
  handleSupabaseError(error) {
    const errorMappings = {
      '23505': 'Ya existe un registro con estos datos únicos',
      '23503': 'Referencia inválida a otro registro',
      '42P01': 'Tabla o vista no encontrada',
      'PGRST116': 'Registro no encontrado',
      '23514': 'Violación de restricción de verificación',
      '23502': 'Campo requerido no puede estar vacío'
    };

    const message = errorMappings[error.code] || error.message || 'Error de base de datos';
    
    const enhancedError = new Error(message);
    enhancedError.code = error.code;
    enhancedError.details = error.details;
    enhancedError.hint = error.hint;
    enhancedError.originalError = error;
    
    return enhancedError;
  }

  /**
   * Transacción simple (para operaciones que requieren múltiples queries)
   */
  async transaction(operations) {
    // Nota: Supabase no tiene transacciones explícitas como PostgreSQL tradicional
    // Esta función simula transacciones ejecutando operaciones en secuencia
    // y haciendo rollback manual si algo falla
    
    const results = [];
    const rollbackOperations = [];

    try {
      for (const operation of operations) {
        const result = await operation();
        results.push(result);
        
        // Si la operación define un rollback, guardarlo
        if (operation.rollback) {
          rollbackOperations.unshift(operation.rollback);
        }
      }

      return results;
    } catch (error) {
      console.error('Transaction failed, attempting rollback:', error);
      
      // Ejecutar rollbacks en orden inverso
      for (const rollback of rollbackOperations) {
        try {
          await rollback();
        } catch (rollbackError) {
          console.error('Rollback operation failed:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Búsqueda con texto completo
   */
  async search(searchTerm, searchFields, options = {}) {
    try {
      if (!searchTerm || !searchFields || searchFields.length === 0) {
        return this.findAll({}, options);
      }

      // Construir query de búsqueda
      const searchConditions = searchFields
        .map(field => `${field}.ilike.%${searchTerm}%`)
        .join(',');

      let query = this.supabase
        .from(this.tableName)
        .select(options.select || '*', { 
          count: options.count ? 'exact' : undefined 
        })
        .or(searchConditions);

      // Aplicar ordenamiento
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Aplicar paginación
      if (options.limit && options.offset !== undefined) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      }

      const result = await query;
      
      if (result.error) {
        throw this.handleSupabaseError(result.error);
      }

      return {
        data: result.data || [],
        count: result.count
      };
    } catch (error) {
      console.error(`Error in ${this.tableName}.search:`, error);
      throw error;
    }
  }
}

export default BaseModel;