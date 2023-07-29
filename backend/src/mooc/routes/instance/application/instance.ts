import { isEmptyNullOrUndefined } from '../../../../../../share/application/isEmptyNullUndefiner'
import { type IInstanceQRStatus, type ISearchInstance } from '../../../../../../share/domain/instance'
import type IInstance from '../../../../../../share/domain/instance'
import { type IHttpStatusCode } from '../../../../../../share/domain/httpResult'
import type IInstanceRepository from '../domian/InstanceRepository'
import { type TypeValidation } from '../../../share/domain/Validator'
import type IWhatsAppController from '../../../whatsAppControl/domian/whatsAppController'
import type IInstanceContructor from '../domian/instance'
import { getScreenId } from '../../../whatsAppControl/infranstructure/getScreenId'

export default class Instance {
  private readonly instanceRepository: IInstanceRepository
  private readonly instanceValidator: TypeValidation
  private readonly urlValidator: TypeValidation
  private readonly whatsAppController: IWhatsAppController

  constructor (
    { instanceRepository, instanceValidator, urlValidator, whatsAppController }: IInstanceContructor
  ) {
    this.instanceRepository = instanceRepository
    this.instanceValidator = instanceValidator
    this.urlValidator = urlValidator
    this.whatsAppController = whatsAppController
  }

  private validateSearchHttp (searchHttp: ISearchInstance): boolean {
    return isEmptyNullOrUndefined(searchHttp.skip) ||
      isEmptyNullOrUndefined(searchHttp.limit)
  }

  async save (instance: IInstance): Promise<IHttpStatusCode> {
    const error = this.instanceValidator(instance)
    if (error !== undefined) {
      return {
        statusCode: 422,
        error
      }
    }
    const instanceSaved = await this.instanceRepository.update(instance)
    this.whatsAppController.start(instanceSaved, 'start')
      .catch(error => {
        console.log(error)
      })
    return {
      statusCode: 200,
      message: {
        instance: instanceSaved,
        info: 'Instance saved successfully'
      }
    }
  }

  async findById (_id: string, userId: string): Promise<IHttpStatusCode> {
    const Instance = await this.instanceRepository.findByIdAndUserId(_id, userId)
    if (Instance === null) {
      return {
        statusCode: 422,
        error: `Instance ${_id} not found`,
        message: 'Instance not found'
      }
    }
    return {
      statusCode: 200,
      message: Instance
    }
  }

  async get (searchHttp: ISearchInstance, userId: string): Promise<IHttpStatusCode> {
    if (this.validateSearchHttp(searchHttp)) {
      return {
        statusCode: 400,
        message: 'Invalid search'
      }
    }
    const Instance = await this.instanceRepository.get(searchHttp)
    return {
      statusCode: 200,
      message: Instance
    }
  }

  async delete (_id: string, userId: string): Promise<IHttpStatusCode> {
    await this.instanceRepository.delete(_id, userId)
    return {
      statusCode: 200,
      message: 'ok'
    }
  }

  async getQr (_id: string, token: string): Promise<IHttpStatusCode> {
    if (isEmptyNullOrUndefined(token)) {
      return {
        statusCode: 422,
        error: 'Token cannot be empty or undefined ',
        message: 'Invalid instance'
      }
    }

    const screenId = getScreenId({ _id, token })
    const instance = await this.instanceRepository.findByIdAndToken(_id, token)

    if (isEmptyNullOrUndefined(instance, screenId) || instance === null) {
      return {
        statusCode: 422,
        error: 'instance id or token is invalid',
        message: 'Invalid instance'
      }
    }

    const screenStatus = await this.whatsAppController.getStatus(screenId)

    // always it try to get the qr and the instance is not active
    // it will try to restart but only do that after one minute
    // because when the instance is initial,it is not active
    const timeFromInitialDate = Math.abs(instance.initialDate.getTime() - new Date().getTime())
    const minute = 1000 * 60

    if (screenStatus === undefined && timeFromInitialDate < minute) {
      await this.whatsAppController.restart(instance)
    }

    const instanceQRStatus: IInstanceQRStatus = {
      qr: instance.qr,
      status: instance.status
    }

    return {
      statusCode: 200,
      message: instanceQRStatus
    }
  }

  async saveWebhookUrl (_id: string, webhookUrl: string): Promise<IHttpStatusCode> {
    const error = this.urlValidator({ webhookUrl })
    if (error !== undefined) {
      return {
        statusCode: 422,
        error
      }
    }
    await this.instanceRepository.saveWebhookUrl(_id, webhookUrl)
    return {
      statusCode: 200,
      message: 'Save Success'
    }
  }

  async saveName (_id: string, name?: string): Promise<IHttpStatusCode> {
    if (isEmptyNullOrUndefined(name) || name === undefined) {
      return {
        statusCode: 422,
        error: 'Name cannot be empty or undefined',
        message: 'Invalid name'
      }
    }
    await this.instanceRepository.saveName(_id, name)
    return {
      statusCode: 200,
      message: 'Name save success'
    }
  }

  async restart (_id: string, token: string): Promise<IHttpStatusCode> {
    if (isEmptyNullOrUndefined(token)) {
      return {
        statusCode: 422,
        error: 'Token is required'
      }
    }
    const instance = await this.instanceRepository.findByIdAndToken(_id, token)
    if (isEmptyNullOrUndefined(instance) || instance === null) {
      return {
        statusCode: 404,
        error: 'Instance does not exist'
      }
    }

    await this.whatsAppController.restart(instance)
    return {
      statusCode: 200,
      message: 'Instance restarted successfully'
    }
  }

  async getRealStatus (_id: string, token: string): Promise<IHttpStatusCode> {
    if (isEmptyNullOrUndefined(token)) {
      return {
        statusCode: 422,
        error: 'Token is required'
      }
    }
    const instance = await this.instanceRepository.findByIdAndToken(_id, token)
    if (isEmptyNullOrUndefined(instance) || instance === null) {
      return {
        statusCode: 404,
        error: 'Instance does not exist'
      }
    }
    const screenId = getScreenId(instance)

    const status = await this.whatsAppController.getStatus(screenId ?? '')
    return {
      statusCode: 200,
      message: status
    }
  }

  async logout (_id: string, token: string): Promise<IHttpStatusCode> {
    if (isEmptyNullOrUndefined(_id) || isEmptyNullOrUndefined(token)) {
      return {
        statusCode: 422,
        error: 'instance id and token are required'
      }
    }

    await this.whatsAppController.logout(_id, token)

    return {
      statusCode: 200,
      message: 'Logout completed successfully'
    }
  }
}
